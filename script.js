import c2wasm from "https://cdn.jsdelivr.net/npm/@ictrobot/c2wasm@0.1.0/+esm";

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

comparisonType.addEventListener("change", () => {
  if (comparisonType.value === "variable") {
    variableNameGroup.classList.remove("hidden");
    customCompareGroup.classList.add("hidden");
  } else if (comparisonType.value === "custom") {
    customCompareGroup.classList.remove("hidden");
    variableNameGroup.classList.add("hidden");
  } else {
    variableNameGroup.classList.add("hidden");
    customCompareGroup.classList.add("hidden");
  }
});

function extractParamsAndReturns(code, language) {
  let params = "";
  let returns = "";
  let returnCount = 0;
  let returnTypes = new Set();

  if (language === 'python') {
    const funcMatch = code.match(/def\s+\w+\s*\(([^)]*)\)(?:\s*->\s*([^:\n]+))?:/);
    if (funcMatch) {
      params = funcMatch[1].split(',').map(s => s.trim()).filter(Boolean).join(', ');
      if (funcMatch[2]) {
        let anno = funcMatch[2].trim();
        if (anno.startsWith('Tuple[')) {
          anno = anno.slice(6, -1);
          anno.split(',').forEach(type => returnTypes.add(type.trim()));
          returnCount = returnTypes.size;
        } else {
          returnTypes.add(anno);
          returnCount = 1;
        }
      }
    }
    const returnStatements = code.match(/return\s+([^\n#]+)/g);
    if (returnStatements) {
      returnCount = returnStatements.length;
      returnStatements.forEach(stmt => {
        const value = stmt.replace(/return\s+/, '').trim();
        if (/None\b/.test(value)) {
          returnTypes.add("None");
        } else if (/(["'])(?:(?=(\\?))\2.)*?\1/.test(value)) {
          returnTypes.add("str");
        } else if (/\d+\.\d+/.test(value)) {
          returnTypes.add("float");
        } else if (/^\d+$/.test(value)) {
          returnTypes.add("int");
        } else if (/^\[.*\]$/.test(value)) {
          returnTypes.add("list");
        } else if (/^\{.*\}$/.test(value)) {
          returnTypes.add("dict");
        } else {
          returnTypes.add("unknown");
        }
      });
    }
  } else if (language === 'c') {
    const funcMatch = code.match(/([a-zA-Z_][\w\s\*]+)\s+\**\s*\w+\s*\(([^)]*)\)/);
    if (funcMatch) {
      let retType = funcMatch[1].trim().replace(/\s+/g, ' ');
      // Check for pointer indication
      if(retType.includes("*")) retType = retType.replace("*", " pointer").trim();
      returnTypes.add(retType);
      params = funcMatch[2].split(',').map(p => p.trim()).filter(Boolean).join(', ');
      returnCount = 1;
    }
  } else if (language === 'javascript') {
    let funcMatch = code.match(/function\s+\w+\s*\(([^)]*)\)/);
    if (funcMatch) {
      params = funcMatch[1].trim();
      returnCount = 1;
    } else {
      funcMatch = code.match(/\(?([^)]*)\)?\s*=>/);
      if (funcMatch) {
        params = funcMatch[1].trim();
        returnCount = 1;
      }
    }
    const jsDoc = code.match(/\/\*\*[\s\S]*?\*\//);
    if (jsDoc) {
      const paramMatches = jsDoc[0].match(/@param\s+{([^}]+)}/g);
      const returnMatch = jsDoc[0].match(/@returns?\s+{([^}]+)}/);
      if (paramMatches) {
        params = paramMatches.map(p => p.match(/@param\s+{([^}]+)}/)[1]).join(', ');
      }
      if (returnMatch) {
        returnTypes.add(returnMatch[1].trim());
        returnCount = 1;
      }
    }
    const returnStatements = code.match(/return\s+([^;]+)/g);
    if (returnStatements) {
      returnCount = returnStatements.length;
      returnStatements.forEach(stmt => {
        const value = stmt.replace(/return\s+/, '').trim();
        if (/null/.test(value)) {
          returnTypes.add("null");
        } else if (/(["'])(?:(?=(\\?))\2.)*?\1/.test(value)) {
          returnTypes.add("string");
        } else if (/\d+\.\d+/.test(value)) {
          returnTypes.add("number (float)");
        } else if (/^\d+$/.test(value)) {
          returnTypes.add("number (int)");
        } else if (/^\[.*\]$/.test(value)) {
          returnTypes.add("Array");
        } else if (/^\{.*\}$/.test(value)) {
          returnTypes.add("object");
        } else {
          returnTypes.add("unknown");
        }
      });
    }
  }
  if (returnTypes.size === 0) {
    returns = "Not specified";
  } else {
    returns = Array.from(returnTypes).join(", ");
  }
  return { params, returns, returnCount };
}

function populateDefaults() {
  document.getElementById("title").value = "Two Sum";
  document.getElementById("summary").value = "Given an array of integers and a target integer, find two numbers in the array that add up to the target.\nUse code with caution.";
  document.getElementById("description").value =
`You are given an array of integers nums and an integer target. You need to return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.
Use code with caution.`;
  document.getElementById("example").value =
`Example:

Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].

Input: nums = [3,2,4], target = 6
Output: [1,2]

Input: nums = [3,3], target = 6
Output: [0,1]
Use code with caution.`;
  document.getElementById("constraints").value =
`- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Only one valid answer exists.
Use code with caution.`;
  document.getElementById("testcases").value =
`[
  {"input": [2,7,11,15], "target": 9, "expected": [0,1]},
  {"input": [3,2,4], "target": 6, "expected": [1,2]},
  {"input": [3,3], "target": 6, "expected": [0,1]},
  {"input": [-1,-3,-8,-9], "target": -10, "expected": [2,3]},
  {"input": [1,2,3,4,5], "target": 7, "expected": [2,3]}
]`;
  document.getElementById("pythonSkeleton").value =
`def twoSum(nums, target):
    # Your code here
    return []  # Placeholder return - should return a list of indices`;
  document.getElementById("cSkeleton").value =
`#include <stdio.h>
#include <stdlib.h>

/**
 * Note: The returned array must be malloced, assume caller calls free().
 */
int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    // Your code here
    *returnSize = 0; // Indicate no elements in the returned array initially
    return NULL;      // Placeholder return - should return malloced array of indices
}`;
  document.getElementById("jsSkeleton").value =
`function twoSum(nums, target) {
    // Your code here
    return []; // Placeholder return - should return an array of indices
}`;
}

document.addEventListener('DOMContentLoaded', () => {
  populateDefaults();
  extractBtn.click(); 
});

extractBtn.addEventListener("click", () => {
  const pythonCode = document.getElementById("pythonSkeleton").value;
  const { params, returns } = extractParamsAndReturns(pythonCode, 'python');
  paramExtracted.value = params || "Could not detect parameters";
  returnExtracted.value = returns || "Could not detect return value";
});

problemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  
  const title = document.getElementById("title").value;
  const summary = document.getElementById("summary").value;
  const description = document.getElementById("description").value;
  const example = document.getElementById("example").value;
  const constraints = document.getElementById("constraints").value;
  const testcases = document.getElementById("testcases").value;
  const pythonSkeleton = document.getElementById("pythonSkeleton").value;
  const cSkeleton = document.getElementById("cSkeleton").value;
  const jsSkeleton = document.getElementById("jsSkeleton").value;
  const paramsExtracted = paramExtracted.value;
  const returnsExtracted = returnExtracted.value;
  const compareType = comparisonType.value;
  const variableName = variableNameInput.value;
  const customCompare = customCompareInput.value;
  
  const skeletonCode = {
    python: pythonSkeleton,
    c: cSkeleton,
    javascript: jsSkeleton
  };
  
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
      <h3>Smart Extraction</h3>
      <p><strong>Parameters:</strong> ${paramsExtracted}</p>
      <p><strong>Return Value(s):</strong> ${returnsExtracted}</p>
      <h3>Output Comparison Options</h3>
      <p><strong>Comparison Type:</strong> ${compareType}</p>
      ${compareType === "variable" ? `<p><strong>Variable:</strong> ${variableName}</p>` : ""}
      ${compareType === "custom" ? `<p><strong>Custom Function:</strong> ${customCompare}</p>` : ""}
    </div>
    <div class="code-editor-section">
      <div class="language-selector">
        <select id="languageSelect">
          <option value="python">Python</option>
          <option value="c">C</option>
          <option value="javascript">JavaScript</option>
        </select>
        <button id="runBtn">Run Code</button>
      </div>
      <textarea class="code-editor" id="codeEditor" rows="20"></textarea>
      <pre id="output"></pre>
    </div>
  `;

  formSection.classList.add("hidden");
  resultSection.classList.remove("hidden");
  
  const languageSelect = document.getElementById("languageSelect");
  const codeEditor = document.getElementById("codeEditor");
  const runBtn = document.getElementById("runBtn");

  languageSelect.addEventListener("change", () => {
    codeEditor.value = skeletonCode[languageSelect.value];
  });

  codeEditor.value = skeletonCode.python;

  runBtn.addEventListener("click", async () => {
    const language = languageSelect.value;
    switch (language) {
      case "python":
        await runPython(compareType, variableName, customCompare);
        break;
      case "c":
        await runC(compareType, variableName, customCompare);
        break;
      case "javascript":
        runJS(compareType, variableName, customCompare);
        break;
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
    await new Promise(resolve => {
      pyScript.onload = resolve;
    });
  }
  if (!pyodide) {
    pyodide = await loadPyodide();
  }
}

async function runPython(compareType, variableName, customCompare) {
  const code = document.getElementById("codeEditor").value;
  const outputElem = document.getElementById("output");
  try {
    if (!pyodide) {
      outputElem.textContent = "Loading Pyodide. Please wait...";
      await loadPyodideAndPackages();
    }
    const testCases = JSON.parse(document.getElementById("testcases").value);
    let compareLogic = "";
    if (compareType === "exact") {
      compareLogic = "result == case['expected']";
    } else if (compareType === "subset") {
      compareLogic = "all(item in result for item in case['expected'])";
    } else if (compareType === "variable") {
      compareLogic = `${variableName} == case['expected']`;
    } else if (compareType === "custom") {
      compareLogic = `custom_compare(result, case['expected'])`;
    }
    let customCompareCode = "";
    if (compareType === "custom" && customCompare.trim()) {
      customCompareCode = `\nfrom js import eval as js_eval\ncustom_compare = js_eval("""${customCompare}""")`;
    }
    const fullCode = `
${code}

def run_tests():
    results = []
    test_cases = ${JSON.stringify(testCases)}
    ${compareType === "custom" ? customCompareCode : ""}
    for case in test_cases:
        result = twoSum(case["input"], case.get("target", None))
        results.append(${compareLogic})
    return results

test_results = run_tests()
print(test_results)
`;
    await pyodide.runPythonAsync(fullCode);
    const testResults = await pyodide.globals.get("test_results").toJs();
    const successRate = testResults.filter(r => r).length;
    const total = testResults.length;
    outputElem.textContent = `Python Test Results: ${successRate}/${total} tests passed`;
  } catch (err) {
    outputElem.textContent = "Error: " + err;
    console.error(err);
  }
}

async function runC(compareType, variableName, customCompare) {
  const code = document.getElementById("codeEditor").value;
  const outputElem = document.getElementById("output");
  try {
    c2wasm.setFlags("default");
    const testCases = JSON.parse(document.getElementById("testcases").value);
    const currentCase = JSON.parse(document.getElementById("testcases").value)[0];
    const inputArray = currentCase.input.join(',');
    const fullCode = `
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
${code}

bool compare_arrays(int* arr1, int* arr2, int size) {
  for (int i = 0; i < size; i++) {
    if (arr1[i] != arr2[i]) return false;
  }
  return true;
}

int main() {
  int test_input[] = {${inputArray}};
  int target = ${currentCase.target || 0};
  int expected[2] = {${currentCase.expected.join(',')}};
  int returnSize = 0;
  int* result = twoSum(test_input, sizeof(test_input)/sizeof(int), target, &returnSize);
  bool passed = false;
  if (returnSize == 2) {
    passed = compare_arrays(result, expected, returnSize);
  }
  free(result);
  printf("%d", passed);
  return 0;
}
`;
    let capturedOutput = "";
    const compiledModule = await c2wasm.compile(fullCode).execute({
      c2wasm: {
        __put_char: (charCode) => {
          capturedOutput += String.fromCharCode(charCode);
        },
        __time: () => performance.now(),
      }
    });
    if (compiledModule.main) {
      compiledModule.main();
    }
    let passed = capturedOutput.trim() === "1";
    outputElem.textContent = "C Test Result: " + (passed ? "Passed" : "Failed");
  } catch (err) {
    outputElem.textContent = "C Error: " + err;
    console.error(err);
  }
}

function runJS(compareType, variableName, customCompare) {
  const code = document.getElementById("codeEditor").value;
  const outputElem = document.getElementById("output");
  try {
    const testCases = JSON.parse(document.getElementById("testcases").value);
    const fn = new Function("return (" + code + ")")();
    let passedCount = 0;
    for (const tc of testCases) {
      const result = fn(tc.input, tc.target);
      let passed = false;
      if (compareType === "exact") {
        passed = JSON.stringify(result) === JSON.stringify(tc.expected);
      } else if (compareType === "subset") {
        if (Array.isArray(result) && Array.isArray(tc.expected)) {
          passed = tc.expected.every(item => result.includes(item));
        }
      } else if (compareType === "variable") {
        passed = result[variableName] === tc.expected;
      } else if (compareType === "custom" && customCompare.trim()) {
        const compareFn = eval(customCompare);
        passed = compareFn(result, tc.expected);
      }
      if (passed) passedCount++;
    }
    outputElem.textContent = "JavaScript Test Results: " + passedCount + "/" + testCases.length + " tests passed";
  } catch (err) {
    outputElem.textContent = "JS Error: " + err;
    console.error(err);
  }
}