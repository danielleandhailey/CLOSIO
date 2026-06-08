import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export default async function handler(req, res) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }],
    });

    return res.status(200).json({
      success: true,
      response: msg.content
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      status: error.status
    });
  }
}
