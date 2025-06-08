import { getServerProfile, checkApiKey } from "@/lib/server/server-chat-helpers"
import { NextRequest } from "next/server"

export const runtime = "edge"

const DIFY_API_URL = "https://api.dify.ai/v1/chat-messages"

interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

export async function POST(request: NextRequest) {  const profile = await getServerProfile()
  const difyApiKey = (profile as any).dify_api_key || ""
  checkApiKey(difyApiKey, "Dify.ai")

  const { messages: rawMessages, stream = true, ...rest } = await request.json()

  // Convert messages to Dify.ai format
  const messages = rawMessages.map((message: any): Message => ({
    role: message.role,
    content: message.content
  }))

  const response = await fetch(DIFY_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${difyApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages,
      stream,
      ...rest
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error)
  }

  // For streaming responses, forward the stream directly
  if (stream && response.headers.get("content-type")?.includes("text/event-stream")) {
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    })
  }

  // Handle non-streaming response
  const data = await response.json()
  return new Response(JSON.stringify({
    id: data.id,
    role: "assistant",
    content: data.message.content
  }), {
    headers: { "Content-Type": "application/json" }
  })
}
