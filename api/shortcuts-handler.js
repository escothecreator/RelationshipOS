// api/shortcuts-handler.js
// This handles requests from iOS Shortcuts

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, context, userId } = req.body;

  try {
    // Detect message platform and extract metadata
    const messageData = parseMessage(message);
    
    // Generate AI response
    const response = await generateResponse(messageData, context, userId);
    
    // Return response for iOS Shortcuts
    res.status(200).json({
      originalMessage: message,
      suggestedResponse: response.text,
      confidence: response.confidence,
      platform: messageData.platform,
      sender: messageData.sender
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate response' });
  }
}

function parseMessage(text) {
  // Detect WhatsApp format: "Contact Name\nMessage text"
  const whatsappPattern = /^(.+?)\n(.+)$/s;
  
  // Detect Instagram format or other patterns
  const instagramPattern = /^@(\w+).*?:\s*(.+)$/s;
  
  if (whatsappPattern.test(text)) {
    const [, sender, message] = text.match(whatsappPattern);
    return {
      platform: 'whatsapp',
      sender: sender.trim(),
      message: message.trim(),
      timestamp: new Date()
    };
  }
  
  if (instagramPattern.test(text)) {
    const [, sender, message] = text.match(instagramPattern);
    return {
      platform: 'instagram',
      sender: sender,
      message: message.trim(),
      timestamp: new Date()
    };
  }
  
  // Default format
  return {
    platform: 'unknown',
    sender: 'Unknown',
    message: text.trim(),
    timestamp: new Date()
  };
}

async function generateResponse(messageData, context, userId) {
  // Get user's response style/preferences
  const userStyle = await getUserStyle(userId);
  
  // Call OpenAI API
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are helping generate a response to a ${messageData.platform} message. 
                   User's communication style: ${userStyle.tone}
                   Keep responses ${userStyle.length} and ${userStyle.formality}.
                   Original message: "${messageData.message}"
                   From: ${messageData.sender}`
        },
        {
          role: 'user', 
          content: `Generate a natural response to this message: "${messageData.message}"`
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    })
  });
  
  const result = await openaiResponse.json();
  
  return {
    text: result.choices[0].message.content,
    confidence: 0.9 // Could implement confidence scoring
  };
}

async function getUserStyle(userId) {
  // Fetch from database or return defaults
  return {
    tone: 'friendly but professional',
    length: 'concise',
    formality: 'casual'
  };
}
