import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty } from '../types';

const fetchGameQuestions = async (topic: string, count: number, difficulty: Difficulty): Promise<Question[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    let difficultyPrompt = "The difficulty must increase progressively from very easy to extremely hard.";
    switch (difficulty) {
        case 'Dễ':
            difficultyPrompt = "The difficulty must increase progressively, starting from very easy questions and ending with medium-difficulty questions.";
            break;
        case 'Khó':
            difficultyPrompt = "The difficulty must increase progressively, starting from medium-difficulty questions and ending with expert-level, very hard questions.";
            break;
        case 'Vừa':
        default:
            // The default prompt is already set for medium
            break;
    }

    const contents = `Generate ${count} trivia questions for a 'Who Wants to Be a Millionaire?' style game, in Vietnamese. The topic is "${topic}". ${difficultyPrompt} For each question, provide the question text, four multiple-choice options (A, B, C, D), and the index of the correct answer (0-3).`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                type: Type.OBJECT,
                properties: {
                    question: {
                        type: Type.STRING,
                        description: 'The question text in Vietnamese.',
                    },
                    options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'An array of 4 possible answers in Vietnamese.',
                    },
                    correctAnswerIndex: {
                        type: Type.INTEGER,
                        description: 'The index (0-3) of the correct answer in the options array.',
                    },
                },
                required: ["question", "options", "correctAnswerIndex"],
                },
            },
        },
    });

    const jsonText = response.text.trim();
    const questions = JSON.parse(jsonText) as Question[];
    
    // Validate the structure of the response
    if (!Array.isArray(questions) || questions.length === 0 || !questions.every(q => 
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctAnswerIndex === 'number' &&
        q.correctAnswerIndex >= 0 && q.correctAnswerIndex < 4
    )) {
      console.error("Invalid data structure received:", questions);
      throw new Error('Invalid question format received from API.');
    }
    
    // The API might not return the exact number, so we handle that gracefully.
    if (questions.length !== count) {
        console.warn(`API returned ${questions.length} questions, but ${count} were requested. Using the returned amount.`);
    }


    return questions;
  } catch (error) {
    console.error("Error fetching questions from Gemini API:", error);
    throw new Error("Failed to generate quiz questions. Please check your API key and try again.");
  }
};

export { fetchGameQuestions };