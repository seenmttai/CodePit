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
    char current_char = s[end];
    if (char_set[(unsigned char)current_char]) {
      start = (start > char_set[(unsigned char)current_char]) ? start : char_set[(unsigned char)current_char];
    }
    char_set[(unsigned char)current_char] = end + 1;
    max_length = (max_length > (end - start + 1)) ? max_length : (end - start + 1);
  }
  return max_length;
}`
};

const DEFAULT_TEMPLATES = {
  python: `
# Python Test Harness for Longest Substring Without Repeating Characters

# Function definition for <<FUNCTION_NAME>>
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

  c: `#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdbool.h>

/* Function definition for user solution */
/* USER SOLUTION HERE */

bool compare_value(int result, int expected) {
  return result == expected;
}

int main() {
  int passCount = 0;
  int total = <<TEST_COUNT>>;
  
  <<TEST_CASES>>
  
  printf("C Test Results: %d/%d tests passed.\\n", passCount, total);
  return passCount == total ? 0 : 1;
}
`
};

let pyodide = null;

const formSection = document.getElementById("formSection");
const resultSection = document.getElementById("resultSection");
const problemForm = document.getElementById("problemForm");
const generatedContent = document.getElementById("generatedContent");
const editBtn = document.getElementById("editBtn");
const extractBtn = document.getElementById("extractBtn");
const paramExtracted = document.getElementById("paramExtracted");
const returnExtracted = document.getElementById("returnExtracted");
const comparisonType = document.getElementById("comparisonType");
const variableNameGroup = document.getElementById("variableNameGroup");
const customCompareGroup = document.getElementById("customCompareGroup");
const variableNameInput = document.getElementById("variableName");
const customCompareInput = document.getElementById("customCompare");
const revealTestBtn = document.getElementById("revealTestBtn");
const languageSelect = document.getElementById("languageSelect");
const codeEditor = document.getElementById("codeEditor");
const insertJSONBtn = document.getElementById("insertJSONBtn");
const questionJSON = document.getElementById("questionJSON");
const fullTemplateEditor = document.getElementById("fullTemplateEditor");
const restoreTemplateBtn = document.getElementById("restoreTemplate");
const updateTemplateBtn = document.getElementById("updateTemplate");

let templateModified = { python: false, c: false };

document.addEventListener("DOMContentLoaded", () => {
  populateDefaults();
  extractBtn.click();
});

const advancedHeader = document.querySelector(".advanced-header");
const advancedContent = document.querySelector(".advanced-content");
advancedHeader.addEventListener("click", () => {
  advancedContent.classList.toggle("expanded");
});

function updateFullTemplate(lang = languageSelect.value) {
  let template = DEFAULT_TEMPLATES[lang];
  const testCasesText = document.getElementById("testcases").value;
  let testCases;
  try {
    testCases = JSON.parse(testCasesText);
  } catch (e) {
    testCases = [];
  }

  const { functionName } = extractParamsAndReturns(codeEditor.value, lang);
  template = template.replace(/<<FUNCTION_NAME>>/g, functionName || "function");

  if (lang === "python") {
    template = template.replace("<<TEST_CASES>>", JSON.stringify(testCases, null, 2));
  } else if (lang === "c") {
    let testCaseCode = '';
    testCases.forEach((tc, idx) => {
      const paramName = `test_input_${idx + 1}`;
      testCaseCode += `
  // Test case ${idx + 1}
  char ${paramName}[256];
  strcpy(${paramName}, "${tc.params[0]}");
  int result_${idx+1} = lengthOfLongestSubstring(${paramName}); 
  if(compare_value(result_${idx+1}, ${tc.expected})) passCount++;
`;
    });
    template = template.replace("<<TEST_COUNT>>", testCases.length);
    template = template.replace("<<TEST_CASES>>", testCaseCode);
  }
  fullTemplateEditor.value = template;
  
  templateModified[lang] = false;
  updateSyncStatus(lang);
}

function updateSyncStatus(lang) {
  const syncStatusElem = document.querySelector(".sync-status");
  if (templateModified[lang]) {
    syncStatusElem.textContent = "Template sync disabled (modified)";
    syncStatusElem.classList.add("sync-disabled");
    syncStatusElem.classList.remove("sync-active");
  } else {
    syncStatusElem.textContent = "Template sync active";
    syncStatusElem.classList.add("sync-active");
    syncStatusElem.classList.remove("sync-disabled");
  }
}

questionJSON.addEventListener("input", () => {
});

insertJSONBtn.addEventListener("click", () => {
  let jsonData;
  try {
    jsonData = JSON.parse(questionJSON.value);
  } catch (e) {
    alert("Invalid JSON format.");
    return;
  }
  if (jsonData.title) document.getElementById("title").value = jsonData.title;
  if (jsonData.summary) document.getElementById("summary").value = jsonData.summary;
  if (jsonData.description) document.getElementById("description").value = jsonData.description;
  if (jsonData.example) document.getElementById("example").value = jsonData.example;
  if (jsonData.constraints) document.getElementById("constraints").value = jsonData.constraints;
  if (jsonData.testcases) document.getElementById("testcases").value = jsonData.testcases;
  if (jsonData.language) {
    languageSelect.value = jsonData.language;
    codeEditor.value = skeletons[jsonData.language] || codeEditor.value;
  }
  if (jsonData.code) codeEditor.value = jsonData.code;
  updateFullTemplate();
});

languageSelect.addEventListener("change", () => {
  codeEditor.value = skeletons[languageSelect.value];
  updateFullTemplate();
});

comparisonType.addEventListener("change", () => {
  if (comparisonType.value === "variable") {
    variableNameGroup.classList.remove("hidden");
  } else {
    variableNameGroup.classList.add("hidden");
  }
  if (comparisonType.value === "custom") {
    customCompareGroup.classList.remove("hidden");
  } else {
    customCompareGroup.classList.add("hidden");
  }
  updateFullTemplate();
});

codeEditor.addEventListener("input", () => {
  updateFullTemplate();
});
document.getElementById("testcases").addEventListener("input", updateFullTemplate);
comparisonType.addEventListener("input", updateFullTemplate);

fullTemplateEditor.addEventListener("input", () => {
  const lang = languageSelect.value;
  templateModified[lang] = true;
  updateSyncStatus(lang);
});

restoreTemplateBtn.addEventListener("click", () => {
  const lang = languageSelect.value;
  templateModified[lang] = false;
  updateSyncStatus(lang);
  updateFullTemplate();
});

updateTemplateBtn.addEventListener("click", () => {
  const lang = languageSelect.value;
  templateModified[lang] = true;
  updateSyncStatus(lang);
});

extractBtn.addEventListener("click", () => {
  const lang = languageSelect.value;
  const code = codeEditor.value;
  const { params, returns } = extractParamsAndReturns(code, lang);
  paramExtracted.value = params || "Could not detect parameters";
  returnExtracted.value = returns || "Could not detect return value(s)";
});

problemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("title").value;
  const summary = document.getElementById("summary").value;
  const description = document.getElementById("description").value;
  const example = document.getElementById("example").value;
  const constraints = document.getElementById("constraints").value;
  const testcases = document.getElementById("testcases").value;
  const userCode = codeEditor.value;
  const compareType = comparisonType.value;
  const variableName = variableNameInput.value;
  const customCompare = customCompareInput.value;
  const formLang = languageSelect.value;

  generatedContent.innerHTML = `
    <div class="problem-section">
      <h2>${title}</h2>
      <p><strong>Summary:</strong> ${summary}</p>
      <h3>Description</h3>
      <p>${description}</p>
      <h3>Example</h3>
      <pre>${example}</pre>
      <h3>Constraints</h3>
      <pre>${constraints}</pre>
      <h3>Test Cases</h3>
      <pre>${testcases}</pre>
      <h3>Extracted Function Signature</h3>
      <p><strong>Parameters:</strong> ${paramExtracted.value}</p>
      <p><strong>Return Value(s):</strong> ${returnExtracted.value}</p>
      <h3>Comparison Method:</h3>
      <p>${compareType}${ (compareType==="variable") ? " | Variable: " + variableName : ""}${ (compareType==="custom") ? " | Custom Function Provided" : ""}</p>
    </div>
    <div class="code-editor-section">
      <div class="language-selector">
        <select id="runLanguageSelect">
          <option value="python" ${formLang==="python"?"selected":""}>Python</option>
          <option value="c" ${formLang==="c"?"selected":""}>C</option>
        </select>
        <button id="runBtn">Run Code</button>
      </div>
      <textarea class="code-editor" id="runEditor" rows="20">${userCode}</textarea>
      <pre id="output"></pre>
    </div>
  `;

  formSection.classList.add("hidden");
  resultSection.classList.remove("hidden");

  const runLanguageSelect = document.getElementById("runLanguageSelect");
  const runEditor = document.getElementById("runEditor");
  const runBtn = document.getElementById("runBtn");
  const outputElem = document.getElementById("output");

  runLanguageSelect.addEventListener("change", () => {
    runEditor.value = skeletons[runLanguageSelect.value];
  });

  runBtn.addEventListener("click", async () => {
    const runLang = runLanguageSelect.value;
    updateFullTemplate(runLang);
  
    let fullCode = fullTemplateEditor.value;
    fullCode = fullCode.split("/* USER SOLUTION HERE */").join(runEditor.value);

    if (runLang === "python") {
      await runPython(fullCode);
    } else if (runLang === "c") {
      await runC(fullCode);
    }
  });
});

editBtn.addEventListener("click", () => {
  resultSection.classList.add("hidden");
  formSection.classList.remove("hidden");
});

revealTestBtn.addEventListener("click", () => {
  alert(document.getElementById("testcases").value);
});

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

async function runPython(fullCode) {
  const outputElem = document.getElementById('output');
  try {
    if (!pyodide) {
      outputElem.textContent = "Loading Pyodide. Please wait...";
      await loadPyodideAndPackages();
    }
    await pyodide.runPythonAsync(fullCode);
    const testResults = await pyodide.globals.get("_test_results").toJs();
    const passed = testResults.filter(t => t).length;
    outputElem.textContent = `Python Test Results: ${passed}/${testResults.length} tests passed.`;
  } catch (err) {
    outputElem.textContent = "Error: " + err;
    console.error(err);
  }
}

async function runC(fullCode) {
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
  } catch (err) {
    outputElem.textContent = "C Error: " + err;
    console.error(err);
  }
}

document.getElementById("resetForm").addEventListener("click", () => {
  populateDefaults();
});

function populateDefaults() {
  document.getElementById("title").value = "Longest Substring Without Repeating Characters";
  document.getElementById("summary").value = "Given a string, find the length of the longest substring without repeating characters.";
  document.getElementById("description").value =
`Given a string s, find the length of the longest substring without repeating characters.

A substring is a contiguous sequence of characters in the string.

Call your function with the provided string parameter.`;
  document.getElementById("example").value =
`Example:
Input: s = "abcabcbb"
Output: 3
Explanation: The longest substring is "abc", with length 3.`;
  document.getElementById("constraints").value =
`- 0 <= s.length <= 5 * 10^4
- s consists of English letters, digits, symbols, and spaces`;
  document.getElementById("testcases").value =
`[
  {"params": ["abcabcbb"], "expected": 3},
  {"params": ["bbbbb"], "expected": 1},
  {"params": ["pwwkew"], "expected": 3},
  {"params": [" "], "expected": 1},
  {"params": [""], "expected": 0}
]`;
  codeEditor.value = skeletons[languageSelect.value];
  updateFullTemplate();
}

function extractParamsAndReturns(code, language) {
  let params = "";
  let returns = "";
  let functionName = "";
  const returnTypes = new Set();

  if (language === "python") {
    const sigRegex = /def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:\n]+))?:/;
    const match = code.match(sigRegex);
    if (match) {
      functionName = match[1];
      params = match[2].split(",").map(s => s.trim()).filter(Boolean).join(", ");
      if(match[3]){
        returnTypes.add(match[3].trim());
      }
    }
    const retRegex = /return\s+(.+)/g;
    let retMatch;
    while ((retMatch = retRegex.exec(code)) !== null) {
      const retVal = retMatch[1].trim();
      if (/^\d+$/.test(retVal)) returnTypes.add("int");
      else if (/^\d+\.\d+$/.test(retVal)) returnTypes.add("float");
      else if (/^['"].*['"]$/.test(retVal)) returnTypes.add("str");
      else returnTypes.add("unknown");
    }
  } else if (language === "c") {
    const sigRegex = /(?:^|\n)\s*([a-zA-Z_][\w\s*\d]+?)\s+(\w+)\s*\(([^)]*)\)\s*\{/m;
    const match = code.match(sigRegex);
    if (match) {
      functionName = match[2];
      params = match[3].split(",").map(p => p.trim()).filter(Boolean).join(", ");
      let retType = match[1].trim().replace(/\s*\*/, "").trim();
      returnTypes.add(retType);
    }
  }
  returns = returnTypes.size ? Array.from(returnTypes).join(", ") : "Not specified";
  return { params, returns, functionName };
}