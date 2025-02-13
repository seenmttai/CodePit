import c2wasm from "https://cdn.jsdelivr.net/npm/@ictrobot/c2wasm@0.1.0/+esm";

function extractParamsAndReturns(code, language) {
  let params = "";
  let returns = "";
  let returnCount = 0;
  let functionName = "";
  const returnTypes = new Set();

  if (language === "python") {
    const sigRegex = /def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:\n]+))?:/;
    const match = code.match(sigRegex);
    if (match) {
      functionName = match[1];
      params = match[2].split(",").map(s => s.trim()).filter(Boolean).join(", ");
      const typeAnno = match[3] ? match[3].trim() : "";
      if (typeAnno) {
        if (/Tuple\s*\[.*\]/.test(typeAnno)) {
          const inner = typeAnno.replace(/Tuple\s*\[|\]/g, "");
          const types = inner.split(",").map(s => s.trim());
          types.forEach(t => returnTypes.add(t));
          returnCount = types.length;
        } else {
          returnTypes.add(typeAnno);
          returnCount = 1;
        }
      }
    }
    const retRegex = /return\s+(.+)/g;
    let retMatch;
    while ((retMatch = retRegex.exec(code)) !== null) {
      const retVal = retMatch[1].trim();
      if (retVal.startsWith("(") && retVal.endsWith(")")) {
        const innerVals = retVal.slice(1, -1).split(",").map(s => s.trim());
        returnCount = innerVals.length;
        innerVals.forEach(val => {
          if (/^\d+$/.test(val)) returnTypes.add("int");
          else if (/^\d+\.\d+$/.test(val)) returnTypes.add("float");
          else if (/^['"].*['"]$/.test(val)) returnTypes.add("str");
          else returnTypes.add("unknown");
        });
      } else {
        returnCount = 1;
        if (/^\d+$/.test(retVal)) returnTypes.add("int");
        else if (/^\d+\.\d+$/.test(retVal)) returnTypes.add("float");
        else if (/^['"].*['"]$/.test(retVal)) returnTypes.add("str");
        else returnTypes.add("unknown");
      }
    }
  } else if (language === "c") {
    const sigRegex = /(?:^|\n)\s*([a-zA-Z_][\w\s\*\d]+?)\s+(\w+)\s*\(([^)]*)\)/m;
    const match = code.match(sigRegex);
    if (match) {
      functionName = match[2];
      params = match[3].split(",").map(p => p.trim()).filter(Boolean).join(", ");
      let retType = match[1].trim();
      if(retType.includes("*")){
        retType = retType.replace(/\*/g, " pointer").trim();
        returnCount = -1; 
      } else {
        returnCount = 1;
      }
      returnTypes.add(retType);
    }
    const retRegex = /return\s+(.+);/g;
    let retMatch;
    while ((retMatch = retRegex.exec(code)) !== null) {
      const retVal = retMatch[1].trim();
      if(retVal.startsWith("{") && retVal.endsWith("}")){
        const innerVals = retVal.slice(1, -1).split(",").map(s => s.trim());
        returnCount = innerVals.length;
        innerVals.forEach(val => returnTypes.add("unknown"));
      }
    }
  }
  
  returns = returnTypes.size ? Array.from(returnTypes).join(", ") : "Not specified";
  return { params, returns, returnCount, returnTypes: Array.from(returnTypes), functionName };
}

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
  c: `#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdbool.h>

int lengthOfLongestSubstring(char* s, int* returnSize) {
  int n = strlen(s);
  int max_length = 0;
  int start = 0;
  int index[256] = {0};
  for (int end = 0; end < n; end++) {
    if(index[(unsigned char)s[end]] > start)
      start = index[(unsigned char)s[end]];
    int curr = end - start + 1;
    if(curr > max_length)
      max_length = curr;
    index[(unsigned char)s[end]] = end + 1;
  }
  *returnSize = 1;
  return max_length;
}`
};

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
}

document.addEventListener("DOMContentLoaded", () => {
  populateDefaults();
  extractBtn.click();
});

languageSelect.addEventListener("change", () => {
  codeEditor.value = skeletons[languageSelect.value];
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
});

extractBtn.addEventListener("click", () => {
  const lang = languageSelect.value;
  const code = codeEditor.value;
  const { params, returns, functionName } = extractParamsAndReturns(code, lang);
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
  const paramsExtracted = paramExtracted.value;
  const returnsExtracted = returnExtracted.value;
  const compareType = comparisonType.value;
  const variableName = variableNameInput.value;
  const customCompare = customCompareInput.value;
  const language = languageSelect.value;

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
      <p><strong>Parameters:</strong> ${paramsExtracted}</p>
      <p><strong>Return Value(s):</strong> ${returnsExtracted}</p>
      <h3>Output Comparison Method:</h3>
      <p>${compareType}${ (compareType==="variable") ? " | Variable: " + variableName : ""}${ (compareType==="custom") ? " | Custom Function Provided" : ""}</p>
    </div>
    <div class="code-editor-section">
      <div class="language-selector">
        <select id="runLanguageSelect">
          <option value="python" ${language==="python"?"selected":""}>Python</option>
          <option value="c" ${language==="c"?"selected":""}>C</option>
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
    const lang = runLanguageSelect.value;
    runEditor.value = skeletons[lang];
  });

  runBtn.addEventListener("click", async () => {
    const lang = runLanguageSelect.value;
    const code = runEditor.value;
    let testCases;
    try {
      testCases = JSON.parse(document.getElementById("testcases").value);
    } catch(e) {
      outputElem.textContent = "Invalid JSON for test cases.";
      return;
    }
    
    if (lang === "python") {
      await runPython(code, testCases, compareType, variableName, customCompare);
    } else if (lang === "c") {
      await runC(code, testCases, compareType, variableName, customCompare);
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

let pyodide = null;
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

async function runPython(code, testCases, compareType, variableName, customCompare) {
  const outputElem = document.getElementById("output");
  try {
    if (!pyodide) {
      outputElem.textContent = "Loading Pyodide. Please wait...";
      await loadPyodideAndPackages();
    }
    const { functionName } = extractParamsAndReturns(code, "python");
    if (!functionName) throw new Error("Could not detect function name in code");
    
    let compareLogic = "";
    if (compareType === "exact") {
      compareLogic = "result == case['expected']";
    } else if (compareType === "subset") {
      compareLogic = "all(item in result for item in case['expected'])";
    } else if (compareType === "variable") {
      compareLogic = `${variableName} == case['expected']`;
    } else if (compareType === "custom") {
      compareLogic = "custom_compare(result, case['expected'])";
    } else if (compareType === "multi" || compareType === "object") {
      compareLogic = "result == case['expected']";
    }
    
    let customCompareCode = "";
    if(compareType === "custom" && customCompare.trim()){
      customCompareCode = `\nfrom js import eval as js_eval\ncustom_compare = js_eval("""${customCompare}""")`;
    }
    
    let fullCode = `${code}
    
def run_tests():
  results = []
  test_cases = ${JSON.stringify(testCases)}
  ${compareType==="custom"? customCompareCode: ""}
  for case in test_cases:
    try:
      result = ${functionName}(*case["params"])
      results.append(${compareLogic})
    except Exception as e:
      results.append(False)
  return results

_test_results = run_tests()
`;
    await pyodide.runPythonAsync(fullCode);
    const testResults = await pyodide.globals.get("_test_results").toJs();
    const passed = testResults.filter(t => t).length;
    outputElem.textContent = `Python Test Results: ${passed}/${testResults.length} tests passed.`;
  } catch (err) {
    outputElem.textContent = "Error: " + err;
    console.error(err);
  }
}

async function runC(code, testCases, compareType, variableName, customCompare) {
  const outputElem = document.getElementById("output");
  try {
    const { functionName } = extractParamsAndReturns(code, "c");
    const funcName = functionName || "lengthOfLongestSubstring";
    
    let fullCode = `#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdbool.h>

${code}

bool compare_value(int result, int expected) {
  return result == expected;
}

int main() {
  int passCount = 0;
  int total = ${testCases.length};
`;
    
    testCases.forEach((tc, index) => {
      let paramDecls = "";
      let callArgs = "";
      tc.params.forEach((param, idx) => {
        const varName = "param" + idx;
        if (typeof param === "string") {
          paramDecls += `  char ${varName}[${param.length + 1}];\n  strcpy(${varName}, "${param}");\n`;
          callArgs += `${varName}, `;
        } else {
          if (Array.isArray(param)) {
            paramDecls += `  int ${varName}[] = {${param.join(',')}};\n`;
            paramDecls += `  int ${varName}Size = sizeof(${varName})/sizeof(int);\n`;
            callArgs += `${varName}, ${varName}Size, `;
          } else {
            callArgs += `${param}, `;
          }
        }
      });
      paramDecls += `  int returnSize = 0;\n`;
      if(callArgs.endsWith(", ")) callArgs = callArgs.slice(0, -2);
      
      fullCode += `
  {
${paramDecls}
  int result = ${funcName}(${callArgs.length ? callArgs + ", " : ""}&returnSize);
  if(compare_value(result, ${tc.expected})) passCount++;
  }
`;
    });
    
    fullCode += `
  printf("C Test Results: %d/%d tests passed.\\n", passCount, total);
  return 0;
}
`;
    
    outputElem.textContent = "Compiling...";
    const response = await fetch('https://c-compile.deno.dev/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
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

languageSelect.value = "python";