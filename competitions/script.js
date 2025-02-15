const SUPABASE_URL = 'https://vekkziumelqjndunkpxj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZla2t6aXVtZWxxam5kdW5rcHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2MTE3MzgsImV4cCI6MjA1NTE4NzczOH0.XWPYixmR7C_TOLh0Ai7HFmGU07Sa2ryZxeEqrd4zwGg';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_TEMPLATES = {
  python: `
# Python Test Harness for <<FUNCTION_NAME>>
/* USER SOLUTION HERE */

def run_tests():
  test_cases = <<TEST_CASES>>
  results = []
  for case in test_cases:
    try:
      result = <<FUNCTION_NAME>>(*case["params"])
      results.append(result == case["expected"])
    except Exception as e:
      print("Error on test case", case, ":", str(e))
      results.append(False)
  return results

_test_results = run_tests()
`,
  c: `
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdbool.h>

/* Function definition for <<FUNCTION_NAME>> */
/* USER SOLUTION HERE */

bool compare_value(int result, int expected) {
  return result == expected;
}

int main() {
  int passCount = 0;
  int total = <<TEST_COUNT>>;
  
  <<TEST_CASES>>
  
  printf("C Test Results: %d/%d tests passed.\\n", passCount, total);
  return passCount >= (total+1)/2 ? 0 : 1;
}
`
};

const skeletons = {
  python: `def lengthOfLongestSubstring(s):
    char_index = {}
    max_length = 0
    start = 0
    for end, char in enumerate(s):
        if char in char_index and char_index[char] >= start:
            start = char_index[char] + 1
        else:
            max_length = max(max_length, end - start + 1)
        char_index[char] = end
    return max_length`,
  c: `int lengthOfLongestSubstring(char* s) {
  int n = strlen(s);
  int char_set[256] = {0};
  int max_length = 0;
  int start = 0;
  
  for (int end = 0; end < n; end++) {
    unsigned char current_char = s[end];
    if (char_set[current_char] && char_set[current_char] > start) {
      start = char_set[current_char];
    }
    char_set[current_char] = end + 1;
    if(end - start + 1 > max_length) {
      max_length = end - start + 1;
    }
  }
  return max_length;
}`
};

let pyodide = null;
let currentRound = "easy"; 
let rounds = { easy: { limit: 8 }, medium: { limit: 4 }, hard: { limit: 2 } };
let examQuestions = { easy: [], medium: [], hard: [] };
let currentQuestionIndex = 0; 

document.addEventListener("DOMContentLoaded", async () => {
  await loadExamQuestions();
  renderRoundInfo();
  renderQuestionList();
  loadQuestion(currentRound, currentQuestionIndex);
  initCopyButton();
});

async function loadExamQuestions() {
  let { data, error } = await supabaseClient.from('Questions').select('*');
  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }
  examQuestions.easy = data.filter(q => q.Type.toLowerCase() === "easy");
  examQuestions.medium = data.filter(q => q.Type.toLowerCase() === "medium");
  examQuestions.hard = data.filter(q => q.Type.toLowerCase() === "hard");
}

function renderRoundInfo() {
  const roundElem = document.getElementById("currentRound");
  let roundText = "";
  if(currentRound === "easy") roundText = "Easy Round";
  else if(currentRound === "medium") roundText = "Medium Round";
  else roundText = "Hard Round";
  roundElem.textContent = roundText;

  const totalElem = document.getElementById("totalCount");
  const solvedElem = document.getElementById("solvedCount");
  const total = examQuestions[currentRound].length;
  let solved = examQuestions[currentRound].filter(q => q._solved).length;
  totalElem.textContent = total;
  solvedElem.textContent = solved;
}

function renderQuestionList() {
  const listElem = document.getElementById("questionList");
  listElem.innerHTML = "";
  examQuestions[currentRound].forEach((q, idx) => {
    const item = document.createElement("div");
    item.className = "question-item";
    item.textContent = `${currentRound.charAt(0).toUpperCase()+currentRound.slice(1)} ${idx+1}`;
    if(q._solved) item.classList.add("solved");
    item.addEventListener("click", () => {
      currentQuestionIndex = idx;
      loadQuestion(currentRound, currentQuestionIndex);
    });
    listElem.appendChild(item);
  });
  renderQuestionProgress();
  renderRoundInfo(); 
}

function loadQuestion(round, index) {
  const q = examQuestions[round][index];
  if(!q) return;
  document.getElementById("questionTitle").textContent = q.Title;
  document.getElementById("questionSummary").textContent = q.Summary;
  document.getElementById("questionDescription").textContent = q.Description;
  document.getElementById("questionExample").textContent = q.Example;
  document.getElementById("questionConstraints").textContent = q.Constraints;
  document.getElementById("questionTestCases").textContent = q.Test_Cases;
  
  document.getElementById("runLanguageSelect").value = "python";
  document.getElementById("runEditor").value = q.Skeleton_Python;
  document.getElementById("output").textContent = "";
  renderQuestionProgress();
}

function initCopyButton() {
  document.getElementById("copyBtn").addEventListener("click", () => {
    const editor = document.getElementById("runEditor");
    navigator.clipboard.writeText(editor.value);
  });
}

document.getElementById("runLanguageSelect").addEventListener("change", () => {
  const lang = document.getElementById("runLanguageSelect").value;
  const q = examQuestions[currentRound][currentQuestionIndex];
  document.getElementById("runEditor").value = lang === "python" ? q.Skeleton_Python : q.Skeleton_C;
});

document.getElementById("runBtn").addEventListener("click", async () => {
  const runLang = document.getElementById("runLanguageSelect").value;
  const question = examQuestions[currentRound][currentQuestionIndex];
  let userCode = document.getElementById("runEditor").value;
  let fullTemplate = "";
  if(runLang === "python") {
    fullTemplate = buildFullTemplate(question, runLang, userCode);
    await runPython(fullTemplate, question);
  } else if(runLang === "c") {
    fullTemplate = buildFullTemplate(question, runLang, userCode);
    await runC(fullTemplate, question);
  }
});

document.getElementById("prevQuestion").addEventListener("click", () => {
  if(currentQuestionIndex > 0) {
    currentQuestionIndex--;
    loadQuestion(currentRound, currentQuestionIndex);
  }
});

document.getElementById("nextQuestion").addEventListener("click", () => {
  if(currentQuestionIndex < examQuestions[currentRound].length - 1) {
    currentQuestionIndex++;
    loadQuestion(currentRound, currentQuestionIndex);
  }
});

function buildFullTemplate(question, lang, userSolution) {
  let template = "";
  let testCases, functionName;
  try {
    testCases = JSON.parse(question.Test_Cases);
  } catch (e) {
    testCases = [];
  }
  if(lang === "python") {
    const sigRegex = /def\s+(\w+)\s*\(/;
    const match = userSolution.match(sigRegex);
    functionName = match ? match[1] : "function";
  } else {
    const sigRegex = /(\w+)\s+(\w+)\s*\(/;
    const match = userSolution.match(sigRegex);
    functionName = match ? match[2] : "function";
  }
  
  template = DEFAULT_TEMPLATES[lang];
  template = template.replace(/<<FUNCTION_NAME>>/g, functionName);
  if(lang === "python") {
    template = template.replace("<<TEST_CASES>>", JSON.stringify(testCases, null, 2));
  } else {
    let testCaseCode = '';
    testCases.forEach((tc, idx) => {
      const paramName = `test_input_${idx+1}`;
      testCaseCode += `
  // Test case ${idx+1}
  char ${paramName}[256];
  strcpy(${paramName}, "${tc.params[0]}");
  int result_${idx+1} = ${functionName}(${paramName});
  if(compare_value(result_${idx+1}, ${tc.expected})) passCount++;
`;
    });
    template = template.replace("<<TEST_COUNT>>", testCases.length);
    template = template.replace("<<TEST_CASES>>", testCaseCode);
  }

  const parts = template.split("/* USER SOLUTION HERE */");
  if (parts.length >= 2) {
    template = parts[0] + userSolution + parts[1];
  }
  
  return template;
}

async function runPython(fullCode, question) {
  const outputElem = document.getElementById('output');
  try {
    if (!pyodide) {
      outputElem.textContent = "Loading Pyodide. Please wait...";
      await loadPyodideAndPackages();
    }
    await pyodide.runPythonAsync(fullCode);
    const testResults = await pyodide.globals.get("_test_results").toJs();
    const passed = testResults.filter(t => t).length;
    const total = testResults.length;
    outputElem.textContent = `Python Test Results: ${passed}/${total} tests passed.`;
    markQuestionSolved(question, passed, total);
  } catch (err) {
    outputElem.textContent = "Error: " + err;
    console.error(err);
  }
}

async function runC(fullCode, question) {
  const outputElem = document.getElementById('output');
  try {
    outputElem.textContent = "Compiling...";
    const response = await fetch('https://c-compile.deno.dev/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: fullCode
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    const outputText = await response.text();
    outputElem.textContent = outputText || "Program finished without output.";
    const regex = /C Test Results:\s*(\d+)\/(\d+)/;
    const m = outputText.match(regex);
    if(m) {
      let passed = parseInt(m[1]);
      let total = parseInt(m[2]);
      markQuestionSolved(question, passed, total);
    }
  } catch (err) {
    outputElem.textContent = "C Error: " + err;
    console.error(err);
  }
}

function renderQuestionProgress() {
  const progressElem = document.getElementById("questionProgress");
  progressElem.innerHTML = ""; 

  const questions = examQuestions[currentRound];
  questions.forEach((q, idx) => {
    const progressDot = document.createElement("div");
    progressDot.className = "progress-dot";
    
    if (idx === currentQuestionIndex) {
      progressDot.classList.add("active");
    }
    
    if (q._solved) {
      progressDot.classList.add("solved");
    }

    progressDot.setAttribute('title', `${currentRound.charAt(0).toUpperCase()+currentRound.slice(1)} Question ${idx+1}`);

    progressElem.appendChild(progressDot);
  });
}

function markQuestionSolved(question, passed, total) {
  const isSolved = passed >= Math.ceil(total/2);
  
  const questions = examQuestions[currentRound];
  const questionIndex = questions.findIndex(q => q === question);
  
  if (questionIndex !== -1) {
    questions[questionIndex]._solved = isSolved;
  }
  
  renderQuestionList();
  renderQuestionProgress();
  renderRoundInfo(); 
  checkRoundAdvance();
}

function checkRoundAdvance() {
  const solvedCount = examQuestions[currentRound].filter(q => q._solved).length;
  const total = examQuestions[currentRound].length;
  if(total > 0 && solvedCount >= Math.ceil(total/2)) {
    if(currentRound === "easy" && examQuestions.medium.length > 0) {
      currentRound = "medium";
      currentQuestionIndex = 0;
      loadQuestion(currentRound, currentQuestionIndex);
    } else if(currentRound === "medium" && examQuestions.hard.length > 0) {
      currentRound = "hard";
      currentQuestionIndex = 0;
      loadQuestion(currentRound, currentQuestionIndex);
    }
    renderRoundInfo();
    renderQuestionList();
  }
}

async function loadPyodideAndPackages() {
  if (!window.loadPyodide) {
    const pyScript = document.createElement("script");
    pyScript.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
    document.head.appendChild(pyScript);
    await new Promise(resolve => { pyScript.onload = resolve; });
  }
  if (!pyodide) {
    pyodide = await loadPyodide();
  }
}