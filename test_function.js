require('dotenv').config(); // Load .env for API key

const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY, {
    // IMPORTANT: Match this baseUrl with the one in index.js
    baseUrl: "https://us-central1-aiplatform.googleapis.com/v1beta",
});

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use gemini-1.5-flash model

async function testGenerate() {
    const category = "history"; // Test category
    const numQuestions = 2; // Test number of questions

    if (!API_KEY) {
        console.error("API Key is not set. Please check your .env file.");
        return;
    }

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

    try {
        console.log("Calling Gemini API with gemini-1.5-flash...");
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        console.log("Raw AI Response:", text);

        const cleanText = text.replace(/```json\s*|```/g, '').trim();
        const quizQuestions = JSON.parse(cleanText);
        console.log("Parsed Quiz Questions:", quizQuestions);
    } catch (error) {
        console.error("Error during test:", error);
    }
}

testGenerate();