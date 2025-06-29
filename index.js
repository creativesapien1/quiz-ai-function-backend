// Load environment variables from .env file for local testing
require('dotenv').config();

// Import the Google Generative AI library
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Get your API key from environment variables
const API_KEY = process.env.GEMINI_API_KEY;

// Initialize the Gemini Generative Model
// IMPORTANT: Add the location here!
const genAI = new GoogleGenerativeAI(API_KEY, {
    // You can choose a region where Gemini 1.5 Flash is available.
    // 'us-central1' is a common choice. 'asia-south1' might be relevant for your location (India).
    // Let's use 'us-central1' as a widely available option for now.
    // If you specifically want 2.5 Flash, change the model ID below to 'gemini-2.5-flash'
    // and ensure you verify its availability in your chosen region.
    // For free tier, 1.5 Flash is generally a very safe bet.
    baseUrl: "https://us-central1-aiplatform.googleapis.com/v1beta",
});

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use gemini-1.5-flash model

/**
 * Responds to any HTTP request.
 *
 * @param {object} req Cloud Function request context.
 * @param {object} res Cloud Function response context.
 */
exports.generateQuizQuestions = async (req, res) => {
    // Set CORS headers for local development and web apps to allow requests from any origin
    res.set('Access-Control-Allow-Origin', '*');

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        return res.status(204).send('');
    }

    const category = req.body.category || req.query.category || 'general knowledge';
    const numQuestions = parseInt(req.body.numQuestions || req.query.numQuestions || '3');

    if (!API_KEY) {
        console.error("GEMINI_API_KEY is not set.");
        return res.status(500).send('Server Error: API key not configured.');
    }

    try {
        const prompt = `Generate exactly ${numQuestions} multiple-choice quiz questions about "${category}". For each question, provide the question text, exactly 4 answer options (labeled A, B, C, D), and the correct answer (just the letter A, B, C, or D). Ensure questions and options are unique and clear.
        
        Format the output strictly as a JSON array of objects, like this:
        [
          {
            "question": "Question text 1?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer_index": 0 // 0 for A, 1 for B, 2 for C, 3 for D
          },
          {
            "question": "Question text 2?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer_index": 1
          }
        ]
        Do not include any other text or formatting. Just the JSON array.`;

        console.log(`Sending prompt to Gemini: ${prompt}`);
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        console.log("Raw AI Response:", text);

        let quizQuestions;
        try {
            const cleanText = text.replace(/```json\s*|```/g, '').trim();
            quizQuestions = JSON.parse(cleanText);
        } catch (jsonError) {
            console.error("Failed to parse AI response as JSON:", jsonError);
            console.error("Problematic AI response was:", text);
            return res.status(500).json({ error: "Failed to parse AI response. It might not have returned valid JSON.", rawResponse: text });
        }

        if (!Array.isArray(quizQuestions) || quizQuestions.some(q =>
            typeof q.question !== 'string' ||
            !Array.isArray(q.options) || q.options.length !== 4 ||
            typeof q.correct_answer_index !== 'number' ||
            q.correct_answer_index < 0 || q.correct_answer_index > 3
        )) {
            console.error("AI generated questions in an unexpected format:", quizQuestions);
            return res.status(500).json({ error: "AI generated questions in an unexpected format. Please try again.", generatedData: quizQuestions });
        }

        res.status(200).json(quizQuestions);

    } catch (error) {
        console.error('Error generating quiz questions:', error);
        res.status(500).json({ error: 'Failed to generate quiz questions.', details: error.message });
    }
};