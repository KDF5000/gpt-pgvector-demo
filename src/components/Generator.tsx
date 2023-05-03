import { Index, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { useThrottleFn } from 'solidjs-use'
import GPT3Tokenizer from 'gpt3-tokenizer'
import IconClear from './icons/Clear'
import MessageItem from './MessageItem'
import ErrorMessageItem from './ErrorMessageItem'
import type { ChatMessage, ErrorMessage } from '@/types'

const systemContent = `You are a helpful assistant. When given CONTEXT you answer questions using only that information,
and you always format your output in markdown. You include code snippets if relevant. If you are unsure and the answer
is not explicitly written in the CONTEXT provided, you say
"Sorry, I don't know how to help with that."  If the CONTEXT includes 
source URLs include them under a SOURCES heading at the end of your response. Always include all of the relevant source urls 
from the CONTEXT, but never list a URL more than once (ignore trailing forward slashes when comparing for uniqueness). Never include URLs that are not in the CONTEXT sections. Never make up URLs`

const userContent = `CONTEXT:
Next.js is a React framework for creating production-ready web applications. It provides a variety of methods for fetching data, a built-in router, and a Next.js Compiler for transforming and minifying JavaScript code. It also includes a built-in Image Component and Automatic Image Optimization for resizing, optimizing, and serving images in modern formats.
SOURCE: nextjs.org/docs/faq
QUESTION: 
what is nextjs?    
`

const assistantContent = `Next.js is a framework for building production-ready web applications using React. It offers various data fetching options, comes equipped with an integrated router, and features a Next.js compiler for transforming and minifying JavaScript. Additionally, it has an inbuilt Image Component and Automatic Image Optimization that helps resize, optimize, and deliver images in modern formats.
\`\`\`js
function HomePage() {
  return <div>Welcome to Next.js!</div>
}
export default HomePage
\`\`\`
SOURCES:
https://nextjs.org/docs/faq`

const promptMessages: ChatMessage[] = [
  {
    role: 'system',
    content: systemContent,
  },
  {
    role: 'user',
    content: userContent,
  },
  {
    role: 'assistant',
    content: assistantContent,
  },
]

export default () => {
  let inputRef: HTMLTextAreaElement
  // const [currentSystemRoleSettings, setCurrentSystemRoleSettings] = createSignal('')
  const [systemRoleEditing, setSystemRoleEditing] = createSignal(false)
  const [messageList, setMessageList] = createSignal<ChatMessage[]>([])
  const [currentError, setCurrentError] = createSignal<ErrorMessage>()
  const [currentAssistantMessage, setCurrentAssistantMessage] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [controller, setController] = createSignal<AbortController>(null)
  const [isStick, setStick] = createSignal(false)

  createEffect(() => (isStick() && smoothToBottom()))

  onMount(() => {
    let lastPostion = window.scrollY

    window.addEventListener('scroll', () => {
      const nowPostion = window.scrollY
      nowPostion < lastPostion && setStick(false)
      lastPostion = nowPostion
    })

    try {
      if (localStorage.getItem('messageList'))
        setMessageList(JSON.parse(localStorage.getItem('messageList')))

      if (localStorage.getItem('stickToBottom') === 'stick')
        setStick(true)
    } catch (err) {
      console.error(err)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    onCleanup(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })
  })

  const handleBeforeUnload = () => {
    localStorage.setItem('messageList', JSON.stringify(messageList()))
    isStick() ? localStorage.setItem('stickToBottom', 'stick') : localStorage.removeItem('stickToBottom')
  }

  const handleButtonClick = async() => {
    const inputValue = inputRef.value
    if (!inputValue)
      return

    inputRef.value = ''
    setMessageList([
      ...messageList(),
      {
        role: 'user',
        content: inputValue,
      },
    ])
    requestWithLatestMessage(inputValue)
    instantToBottom()
  }

  const smoothToBottom = useThrottleFn(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, 300, false, true)

  const instantToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
  }

  const requestWithLatestMessage = async(inputValue: string) => {
    setLoading(true)
    setCurrentAssistantMessage('')
    setCurrentError(null)
    try {
      const controller = new AbortController()
      setController(controller)

      // 1. get embeding
      // const embedingResponse = await fetch('/api/embedding', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     message: inputValue,
      //   }),
      // })

      // if (!embedingResponse.ok) {
      //   const error = await embedingResponse.json()
      //   console.error(error.error)
      //   setCurrentError(error.error)
      //   throw new Error('Request failed')
      // }
      // const { embedding } = await embedingResponse.json()
      // if (!embedding)
      //   throw new Error('No embedding')
      // const t1 = Date.now()
      // console.log('generate embedding cost ', (t1 - t0))

      // 2. search embeding from pg
      const searchResponse = await fetch('/api/search', {
        method: 'POST',
        body: JSON.stringify({
          message: inputValue,
          similarity: 0.1,
          limit: 3,
        }),
      })

      if (!searchResponse.ok) {
        const error = await searchResponse.json()
        console.error(error.error)
        setCurrentError(error.error)
        throw new Error('Request failed')
      }

      const { documents } = await searchResponse.json()
      const tokenizer = new GPT3Tokenizer({ type: 'gpt3' })
      let tokenCount = 0
      let contextText = ''
      // Concat matched documents
      if (documents) {
        for (let i = 0; i < documents.length; i++) {
          const document = documents[i]
          const content = document.content
          const url = document.url
          const encoded = tokenizer.encode(content)
          tokenCount += encoded.text.length

          // Limit context to max 1500 tokens (configurable)
          if (tokenCount > 3500)
            break

          contextText += `${content.trim()}\nSOURCE: ${url}\n---\n`
        }
      }

      const userMessage = `CONTEXT:
      ${contextText}
      
      USER QUESTION: 
      ${inputValue}  
      `

      const t0 = Date.now()
      // 3. send to gpt
      const requestMessageList = [
        ...promptMessages,
        {
          role: 'user',
          content: userMessage,
        },
      ]

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          messages: requestMessageList,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const error = await response.json()
        console.error(error.error)
        setCurrentError(error.error)
        throw new Error('Request failed')
      }
      const data = response.body
      if (!data)
        throw new Error('No data')

      const t1 = Date.now()
      console.log('gpt request cost ', (t1 - t0))

      const reader = data.getReader()
      const decoder = new TextDecoder('utf-8')
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        if (value) {
          const char = decoder.decode(value)
          if (char === '\n' && currentAssistantMessage().endsWith('\n'))
            continue

          if (char)
            setCurrentAssistantMessage(currentAssistantMessage() + char)

          isStick() && instantToBottom()
        }
        done = readerDone
      }
    } catch (e) {
      console.error(e)
      setLoading(false)
      setController(null)
      return
    }
    archiveCurrentMessage()
    isStick() && instantToBottom()
  }

  const archiveCurrentMessage = () => {
    if (currentAssistantMessage()) {
      setMessageList([
        ...messageList(),
        {
          role: 'assistant',
          content: currentAssistantMessage(),
        },
      ])
      setCurrentAssistantMessage('')
      setLoading(false)
      setController(null)
      inputRef.focus()
    }
  }

  const clear = () => {
    inputRef.value = ''
    inputRef.style.height = 'auto'
    setMessageList([])
    setCurrentAssistantMessage('')
    setCurrentError(null)
  }

  const stopStreamFetch = () => {
    if (controller()) {
      controller().abort()
      archiveCurrentMessage()
    }
  }

  const retryLastFetch = () => {
    if (messageList().length > 0) {
      const lastMessage = messageList()[messageList().length - 1]
      if (lastMessage.role === 'assistant')
        setMessageList(messageList().slice(0, -1))

      requestWithLatestMessage(lastMessage.content)
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.isComposing || e.shiftKey)
      return

    if (e.keyCode === 13) {
      e.preventDefault()
      handleButtonClick()
    }
  }

  return (
    <div my-6>
      {/* <SystemRoleSettings
        canEdit={() => messageList().length === 0}
        systemRoleEditing={systemRoleEditing}
        setSystemRoleEditing={setSystemRoleEditing}
        currentSystemRoleSettings={currentSystemRoleSettings}
        setCurrentSystemRoleSettings={setCurrentSystemRoleSettings}
      /> */}
      <Index each={messageList()}>
        {(message, index) => (
          <MessageItem
            role={message().role}
            message={message().content}
            showRetry={() => (message().role === 'assistant' && index === messageList().length - 1)}
            onRetry={retryLastFetch}
          />
        )}
      </Index>
      {currentAssistantMessage() && (
        <MessageItem
          role="assistant"
          message={currentAssistantMessage}
        />
      )}
      { currentError() && <ErrorMessageItem data={currentError()} onRetry={retryLastFetch} /> }
      <Show
        when={!loading()}
        fallback={() => (
          <div class="gen-cb-wrapper">
            <span>AI is thinking...</span>
            <div class="gen-cb-stop" onClick={stopStreamFetch}>Stop</div>
          </div>
        )}
      >
        <div class="gen-text-wrapper" class:op-50={systemRoleEditing()}>
          <textarea
            ref={inputRef!}
            disabled={systemRoleEditing()}
            onKeyDown={handleKeydown}
            placeholder="Enter something..."
            autocomplete="off"
            autofocus
            onInput={() => {
              inputRef.style.height = 'auto'
              inputRef.style.height = `${inputRef.scrollHeight}px`
            }}
            rows="1"
            class="gen-textarea"
          />
          <button onClick={handleButtonClick} disabled={systemRoleEditing()} gen-slate-btn>
            Send
          </button>
          <button title="Clear" onClick={clear} disabled={systemRoleEditing()} gen-slate-btn>
            <IconClear />
          </button>
        </div>
      </Show>
      <div class="fixed bottom-5 left-5 rounded-md hover:bg-slate/10 w-fit h-fit transition-colors active:scale-90" class:stick-btn-on={isStick()}>
        <div>
          <button class="p-2.5 text-base" title="stick to bottom" type="button" onClick={() => setStick(!isStick())}>
            <div i-ph-arrow-line-down-bold />
          </button>
        </div>
      </div>
    </div>
  )
}
