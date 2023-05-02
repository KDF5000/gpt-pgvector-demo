// // #vercel-disable-blocks
// import { ProxyAgent, fetch } from 'undici'
// // #vercel-end
// import { generateEmbeddingPayload } from '@/utils/openAI'
// import type { APIRoute } from 'astro'

// const baseUrl = ((import.meta.env.OPENAI_API_BASE_URL) || 'https://api.openai.com').trim().replace(/\/$/, '')
// const apiKey = import.meta.env.OPENAI_API_KEY
// const httpsProxy = import.meta.env.HTTPS_PROXY

// export const post: APIRoute = async(context) => {
//   const body = await context.request.json()
//   const { message } = body
//   if (!message) {
//     return new Response(JSON.stringify({
//       error: {
//         message: 'No input text.',
//       },
//     }), { status: 400 })
//   }

//   const initOptions = generateEmbeddingPayload(apiKey, message)
//   // #vercel-disable-blocks
//   if (httpsProxy)
//     initOptions.dispatcher = new ProxyAgent(httpsProxy)
//   // #vercel-end

//   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//   // @ts-expect-error
//   const embeddingResponse = await fetch(`${baseUrl}/v1/embeddings`, initOptions).catch((err: Error) => {
//     console.error(err)
//     return new Response(JSON.stringify({
//       error: {
//         code: err.name,
//         message: err.message,
//       },
//     }), { status: 500 })
//   }) as Response

//   const embeddingData = await embeddingResponse.json()
//   const [{ embedding }] = embeddingData.data
//   //   console.log(embedding)
//   return {
//     body: JSON.stringify({
//       embedding,
//     }),
//   }
// }
