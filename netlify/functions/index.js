// Load environment variables from .env file for local testing
// This line is for local testing. Netlify will use its own environment variables.
require('dotenv').config();

// Import the Google Generative AI library
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Get your API key from environment variables (Netlify will inject this)
const API_KEY = process.env.GEMINI_API_KEY; // Ensure you set GEMINI_API_KEY in Netlify env vars!

// Initialize the Gemini Generative Model
// IMPORTANT: Add the location here!
// Netlify Functions run in AWS Lambda, so us-central1 is generally a good choice.
const genAI = new GoogleGenerativeAI(API_KEY, {
    baseUrl: "https://us-central1-aiplatform.googleapis.com/v1beta",
});

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use gemini-1.5-flash model

/**
 * Netlify Function handler.
 * @param {object} event The event object containing request details (like body, queryStringParameters).
 * @param {object} context The context object.
 * @returns {object} An object with statusCode, headers, and body.
 */
exports.handler = async (event, context) => {
    // Netlify Functions handle CORS automatically to some extent, but
    // explicit headers are good practice if you need fine-grained control
    // For local development, you might still need cors npm package if not using Netlify Dev.
    // For deployed Netlify functions, Cross-Origin-Allow is handled by Netlify by default for functions.
    // So, we can remove the res.set('Access-Control-Allow-Origin', '*') part here.

    // Netlify functions get parameters from event.queryStringParameters (for GET)
    // or event.body (for POST).
    // Ensure the body is parsed if it's JSON.
    let body;
    try {
        body = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
        // If body is not valid JSON, treat it as empty for now
        body = {};
    }


    const category = body.category || event.queryStringParameters.category || 'general knowledge';
    const numQuestions = parseInt(body.numQuestions || event.queryStringParameters.numQuestions || '3');

    if (!API_KEY) {
        console.error("GEMINI_API_KEY is not set.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server Error: API key not configured.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        const prompt = `Generate exactly ${numQuestions} multiple-choice quiz questions about "${category}". For each question, provide the question text, exactly 4 answer options (labeled A, B, C, D), and the correct answer (just the letter A, B, C, or D). Ensure questions and options are unique and clear.
        
        Format the output strictly as a JSON array of objects, like this:
        [
          {
            "question": "Question text 1?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer_index": 0 // 0 for A, 1 for B, 2 for C, 3 for D
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
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Failed to parse AI response. It might not have returned valid JSON.", rawResponse: text }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        if (!Array.isArray(quizQuestions) || quizQuestions.some(q =>
            typeof q.question !== 'string' ||
            !Array.isArray(q.options) || q.options.length !== 4 ||
            typeof q.correct_answer_index !== 'number' ||
            q.correct_answer_index < 0 || q.correct_answer_index > 3
        )) {
            console.error("AI generated questions in an unexpected format:", quizQuestions);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "AI generated questions in an unexpected format. Please try again.", generatedData: quizQuestions }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(quizQuestions),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        console.error('Error generating quiz questions:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate quiz questions.', details: error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};