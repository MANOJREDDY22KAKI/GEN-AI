// Import PDF.js libraries
import * as pdfjsLib from 'https://mozilla.github.io/pdf.js/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';

// Global environment variables provided by the Canvas runtime
// IMPORTANT: If running this file directly on your local machine (using the file:/// protocol),
// you MUST replace the empty string below with your actual Gemini API Key (e.g., const apiKey = "AIza...").
const apiKey = ""; // <-- **REPLACE THIS EMPTY STRING WITH YOUR KEY**
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// --- Core Application Logic ---

const APP_STATE = {
    chatHistory: [],
    isProcessing: false,
    reportText: '',
    fileName: '',
    // Exponential backoff settings
    maxRetries: 5,
    initialDelay: 1000 // 1 second
};

// DOM elements (declared globally for easy access)
let chatWindow;
let userInput;
let fileInput;
let submitButton;
let loadingIndicator;
let errorContainer;
let fileStatus;
let contentPreview;

// Utility to display messages (User and AI)
function appendMessage(sender, text, isError = false) {
    const messageElement = document.createElement('div');
    messageElement.className = 'flex mb-4 last:mb-0';

    const alignment = sender === 'user' ? 'justify-end' : 'justify-start';
    const bgColor = sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 border border-gray-200';
    const borderRadius = sender === 'user' ? 'rounded-tl-xl rounded-bl-xl rounded-br-xl' : 'rounded-tr-xl rounded-br-xl rounded-bl-xl';

    messageElement.classList.add(alignment);

    messageElement.innerHTML = `
        <div class="max-w-3xl px-4 py-3 shadow-lg ${bgColor} ${borderRadius}">
            <div class="font-semibold mb-1 ${sender === 'user' ? 'text-indigo-200' : 'text-indigo-600'}">${sender === 'user' ? 'You' : 'AI Analyst'}</div>
            <div class="${isError ? 'text-red-500 font-medium' : ''}">${text.replace(/\n/g, '<br>')}</div>
        </div>
    `;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll to bottom
}

// Checks if data is loaded and a query is present
function checkInputs() {
    const hasData = APP_STATE.reportText.length > 0;
    const hasQuery = userInput.value.trim().length > 0;
    // Only enable if both fields have content AND we are not processing a previous request
    submitButton.disabled = !(hasData && hasQuery) || APP_STATE.isProcessing;
}

function toggleLoading(isLoading, message = 'Analyzing report data...') {
    APP_STATE.isProcessing = isLoading;
    loadingIndicator.textContent = isLoading ? message : '';
    loadingIndicator.style.display = isLoading ? 'block' : 'none';
    userInput.disabled = isLoading;
    fileInput.disabled = isLoading;
    checkInputs(); 
}

function clearError() {
    errorContainer.textContent = '';
    errorContainer.classList.add('hidden');
}

function displayError(message) {
    errorContainer.textContent = `Error: ${message}`;
    errorContainer.classList.remove('hidden');
    toggleLoading(false);
}

// --- File Parsing Logic ---

/**
 * Extracts text from a PDF file using PDF.js
 * @param {File} file 
 */
async function processPDF(file) {
    toggleLoading(true, 'Extracting text from PDF...');
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function() {
            const arrayBuffer = this.result;
            try {
                const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let textContent = '';
                
                // Extract text page by page
                for (let i = 1; i <= pdfDocument.numPages; i++) {
                    const page = await pdfDocument.getPage(i);
                    const text = await page.getTextContent();
                    textContent += text.items.map(item => item.str).join(' ') + '\n\n';
                }
                resolve(textContent.trim());

            } catch (error) {
                reject(`PDF Parsing failed: ${error.message}`);
            } finally {
                toggleLoading(false);
            }
        };
        reader.onerror = () => reject('Error reading file data.');
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Extracts text from plain text/CSV files
 * @param {File} file 
 */
function processText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function() {
            resolve(this.result);
        };
        reader.onerror = () => reject('Error reading file data.');
        reader.readAsText(file);
    });
}


async function handleFileUpload(event) {
    clearError();
    APP_STATE.reportText = '';
    APP_STATE.fileName = '';
    contentPreview.textContent = 'Awaiting file upload...';

    const file = event.target.files[0];
    if (!file) return;

    const name = file.name;
    const extension = name.split('.').pop().toLowerCase();
    APP_STATE.fileName = name;

    try {
        let extractedText = '';

        if (extension === 'txt' || extension === 'csv') {
            extractedText = await processText(file);
        } else if (extension === 'pdf') {
            extractedText = await processPDF(file);
        } else {
            displayError(`Unsupported file type: .${extension}. Please use .txt, .csv, or .pdf.`);
            fileStatus.textContent = `File: ${name} (Unsupported)`;
            return;
        }

        if (extractedText.length > 10000) {
             displayError('File content is too large (> 10,000 characters) for reliable client-side analysis. Only the first 10,000 characters will be analyzed.');
             extractedText = extractedText.substring(0, 10000);
        }

        APP_STATE.reportText = extractedText;
        contentPreview.textContent = extractedText.substring(0, 500) + (extractedText.length > 500 ? '...\n\n[Content truncated for preview]' : '');
        fileStatus.textContent = `File: ${name} (${extractedText.length} characters loaded)`;
        
    } catch (error) {
        APP_STATE.reportText = '';
        fileStatus.textContent = `File: ${name} (Error)`;
        contentPreview.textContent = `[Parsing Error] ${error}`;
        displayError(`Failed to process file: ${error.message || error}`);
    } finally {
        toggleLoading(false); // Ensure loading is off after file processing
        checkInputs(); // Update button state
    }
}


// --- API Call Function with Retry Logic ---
async function fetchWithBackoff(url, options, attempt = 1) {
    try {
        let finalUrl = url;
        
        if (apiKey && !url.includes('?key=')) { 
            finalUrl = `${url}?key=${apiKey}`;
        } else if (!apiKey) {
            throw new Error("API Key is missing. Please enter your Gemini API key in the 'apiKey' variable within the script.");
        }
        
        const response = await fetch(finalUrl, options);

        if (!response.ok) {
            if (response.status === 429 || response.status >= 500) {
                throw new Error(`Server error or rate limit exceeded (Status: ${response.status})`);
            }
            if (response.status === 400 || response.status === 401) {
                const errorBody = await response.json();
                if (errorBody.error && errorBody.error.message.includes("API key")) {
                    throw new Error("Invalid or missing API key. Please check the 'apiKey' variable in the script.");
                }
            }
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return response;
    } catch (error) {
        if (attempt < APP_STATE.maxRetries) {
            const delay = APP_STATE.initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            console.warn(`Attempt ${attempt} failed. Retrying in ${Math.round(delay / 1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithBackoff(url, options, attempt + 1);
        } else {
            console.error("Max retries reached. Failing request.", error);
            throw error;
        }
    }
}


async function sendMessage() {
    const userQuery = userInput.value.trim();
    const reportData = APP_STATE.reportText;
    clearError();

    if (!userQuery || !reportData) {
        displayError("Please ensure a file is loaded and a question is entered.");
        return;
    }
    
    toggleLoading(true);
    appendMessage('user', userQuery);
    userInput.value = ''; 
    checkInputs();

    // 1. Construct the combined prompt for RAG simulation
    const systemInstruction = `You are a world-class Data Analyst AI. Your task is to analyze the user's question in the context of the provided report data.
    1. The data is from a report named "${APP_STATE.fileName}". Analyze the data meticulously, treating it as tabular (CSV or similar structure).
    2. Answer the user's question based ONLY on the data provided in the 'REPORT DATA' section.
    3. If the answer cannot be determined from the data, state that clearly.
    4. Provide a clear, concise, and professional response, summarizing any key findings before answering the specific question.`;
    
    const fullPrompt = `QUESTION: ${userQuery}\n\n--- REPORT DATA ---\n${reportData}`;
    
    // 2. Prepare the API payload
    const payload = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
    };

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };

    try {
        const response = await fetchWithBackoff(apiUrl, options);
        const result = await response.json();

        const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response. The model output was empty.";
        
        // 3. Update history and display response
        APP_STATE.chatHistory.push({ role: 'user', text: userQuery });
        APP_STATE.chatHistory.push({ role: 'ai', text: aiResponse });

        appendMessage('ai', aiResponse);

    } catch (error) {
        console.error("API Request Failed:", error);
        displayError(`Failed to connect or process the request: ${error.message}`);
        appendMessage('ai', "I apologize, but I encountered a system error while trying to analyze your data.", true);
    } finally {
        toggleLoading(false); // Enable inputs and re-check button status
    }
}

function setupEventListeners() {
    // Assign DOM elements
    chatWindow = document.getElementById('chat-window');
    userInput = document.getElementById('user-input');
    fileInput = document.getElementById('file-input');
    submitButton = document.getElementById('submit-button');
    loadingIndicator = document.getElementById('loading-indicator');
    errorContainer = document.getElementById('error-container');
    fileStatus = document.getElementById('file-status');
    contentPreview = document.getElementById('content-preview');

    // Add event listeners
    fileInput.addEventListener('change', handleFileUpload);
    userInput.addEventListener('input', checkInputs);
    submitButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !submitButton.disabled) {
            sendMessage();
        }
    });

    // Initial setup
    checkInputs();
    appendMessage('ai', "Welcome to the AI Report File Analyst! Please upload a PDF, TXT, or CSV file below to begin chatting with your data.");
}

window.onload = setupEventListeners;