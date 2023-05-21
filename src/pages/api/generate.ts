// #vercel-disable-blocks
import { ProxyAgent, fetch } from 'undici'
// #vercel-end
import { generatePayload, parseOpenAIStream } from '@/utils/openAI'
import type { APIRoute } from 'astro'
import type { ChatMessage } from '@/types'

const apiKey = import.meta.env.OPENAI_API_KEY
const httpsProxy = import.meta.env.HTTPS_PROXY
const baseUrl = ((import.meta.env.OPENAI_API_BASE_URL) || 'https://api.openai.com').trim().replace(/\/$/, '')

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

export const post: APIRoute = async(context) => {
  const body = await context.request.json()
  const { messages } = body
  if (!messages) {
    return new Response(JSON.stringify({
      error: {
        message: 'No input text.',
      },
    }), { status: 400 })
  }

  const requestMessageList = [
    ...promptMessages,
    messages,
  ]

  const initOptions = generatePayload(apiKey, requestMessageList)
  // #vercel-disable-blocks
  if (httpsProxy)
    initOptions.dispatcher = new ProxyAgent(httpsProxy)
  // #vercel-end

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const response = await fetch(`${baseUrl}/v1/chat/completions`, initOptions).catch((err: Error) => {
    console.error(err)
    return new Response(JSON.stringify({
      error: {
        code: err.name,
        message: err.message,
      },
    }), { status: 500 })
  }) as Response

  return parseOpenAIStream(response) as Response
}
