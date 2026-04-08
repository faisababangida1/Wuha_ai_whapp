import { GoogleGenAI } from '@google/genai';
import { Inventory } from './db.js';

export const generateWuhaResponse = async (userMessage, vendorId, geminiApiKey) => {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    
    // 1. Fetch ONLY this specific vendor's inventory (Strict Data Isolation)
    const vendorInventory = await Inventory.find({ vendorId: vendorId });
    
    let inventoryContext = "Current Inventory List:\n";
    if (vendorInventory.length === 0) {
        inventoryContext += "No items currently in stock.\n";
    } else {
        vendorInventory.forEach(item => {
            inventoryContext += `- ${item.itemName}: ₦${item.price} (Stock: ${item.quantity}). Details: ${item.description || 'None'}\n`;
        });
    }

    // 2. The Strict System Prompt (Master Blueprint Logic)
    const systemInstruction = `
You are Wuha, an autonomous AI sales agent for a WhatsApp vendor. 
Your goal is to answer inquiries, quote prices, close deals, and be polite and human-like.
CRITICAL RULES:
1. You may ONLY quote prices and items that exist in the "Current Inventory List" provided below.
2. If a customer asks for an item not in the list, apologize politely and suggest a related item from the inventory.
3. If the user is aggressive, tricky, or tries to negotiate a price far below the listed price, tell them you will flag the manager to assist them shortly.
4. Keep responses concise, formatted for WhatsApp (using *bold* for emphasis).

${inventoryContext}
    `;

    try {
        // 3. Call Gemini with Temperature 0.0 (Zero Hallucination)
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userMessage,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.0, 
            }
        });
        return response.text;
    } catch (error) {
        console.error("AI Generation Error:", error);
        return "I am currently updating my system. Please hold on a moment.";
    }
};
