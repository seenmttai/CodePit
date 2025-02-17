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

document.addEventListener("DOMContentLoaded", () => {
  populateDefaults();
  loadQuestionTypes(); 
  document.getElementById("questionType").addEventListener("change", () => {
    loadQuestionData();
  });
  initEventListeners();
});

function populateDefaults() {
  const lang = document.getElementById("languageSelect").value;
  document.getElementById("codeEditor").value = skeletons[lang];
  updateFullTemplate();
}

async function loadQuestionTypes() {
  const { data, error } = await supabaseClient.from('Questions').select('*');
  if (error) {
    console.error('Error fetching question types:', error);
    return;
  }
  const limits = { easy: 8, medium: 4, hard: 2 };
  let counts = { easy: 0, medium: 0, hard: 0 };
  data.forEach(q => {
    const dt = q.Type.toLowerCase();
    if (dt in counts) counts[dt]++;
  });
  const qtSelect = document.getElementById("questionType");
  qtSelect.innerHTML = "";
  Object.keys(limits).forEach(diff => {
    for(let idx = 1; idx <= limits[diff]; idx++){
      const option = document.createElement("option");
      option.value = `${diff}-${idx}`;
      option.textContent = `${diff.charAt(0).toUpperCase() + diff.slice(1)} ${idx}`;
      option.disabled = idx > (counts[diff] + 1);
      qtSelect.appendChild(option);
    }
  });
  updateDifficultyFromType();
}


async function loadQuestionData() {
  const qtVal = document.getElementById("questionType").value;
  const [diff, indexStr] = qtVal.split("-");
  const index = parseInt(indexStr);
  const { data, error } = await supabaseClient
    .from('Questions')
    .select('*')
    .eq('Type', diff.toUpperCase())
    .order('Title', { ascending: true });
  if(error) {
    console.error('Error loading question:', error);
    return;
  }
  if(data && data.length >= index) {
    const q = data[index - 1];
    document.getElementById("title").value = q.Title || "";
    document.getElementById("summary").value = q.Summary || "";
    document.getElementById("description").value = q.Description || "";
    document.getElementById("example").value = q.Example || "";
    document.getElementById("constraints").value = q.Constraints || "";
    document.getElementById("testcases").value = q.Test_Cases || "";
    document.getElementById("comparisonType").value = q.Comparison_Type || "exact";
    skeletons.python = q.Skeleton_Python || skeletons.python;
    skeletons.c = q.Skeleton_C || skeletons.c;
    document.getElementById("fullTemplateEditor").value =
      diff.toLowerCase() === "easy" ? (q.Full_Template_Python || DEFAULT_TEMPLATES.python) : (q.Full_Template_C || DEFAULT_TEMPLATES.c);
    const lang = document.getElementById("languageSelect").value;
    document.getElementById("codeEditor").value = lang === "python" ? skeletons.python : skeletons.c;
  } else {
    document.getElementById("title").value = "";
    document.getElementById("summary").value = "";
    document.getElementById("description").value = "";
    document.getElementById("example").value = "";
    document.getElementById("constraints").value = "";
    document.getElementById("testcases").value = "";
    populateDefaults();
  }
  updateFullTemplate();
}

function updateDifficultyFromType() {
  const qtVal = document.getElementById("questionType").value;
  const [diff] = qtVal.split("-");
  document.getElementById("difficulty").value = diff;
}

function updateFullTemplate(lang = document.getElementById("languageSelect").value) {
  const defaultTemplate = DEFAULT_TEMPLATES[lang] || "";
  let template = defaultTemplate;
  const testCasesText = document.getElementById("testcases").value;
  let testCases;
  try {
    testCases = JSON.parse(testCasesText);
  } catch (e) {
    testCases = [];
  }
  const code = document.getElementById("codeEditor").value;
  let functionName = "function";
  if(lang === "python") {
    const sigRegex = /def\s+(\w+)\s*\(/;
    const match = code.match(sigRegex);
    if(match) functionName = match[1];
  } else {
    const sigRegex = /(\w+)\s+(\w+)\s*\(/;
    const match = code.match(sigRegex);
    if(match) functionName = match[2];
  }
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
  document.getElementById("fullTemplateEditor").value = template;
}

function initEventListeners() {
  document.getElementById("languageSelect").addEventListener("change", () => {
    const lang = document.getElementById("languageSelect").value;
    document.getElementById("codeEditor").value = skeletons[lang];
    updateFullTemplate();
  });
  
  document.getElementById("codeEditor").addEventListener("input", () => {
    const lang = document.getElementById("languageSelect").value;
    skeletons[lang] = document.getElementById("codeEditor").value;
    updateFullTemplate();
  });
  
  document.getElementById("testcases").addEventListener("input", updateFullTemplate);
  
  document.getElementById("insertJSONBtn").addEventListener("click", () => {
    let jsonData;
    try {
      jsonData = JSON.parse(document.getElementById("questionJSON").value);
      const requiredFields = ['title', 'summary', 'description', 'example', 'constraints', 'testcases'];
      const missingFields = requiredFields.filter(field => !jsonData[field]);
      if(missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      document.getElementById("title").value = jsonData.title || "";
      document.getElementById("summary").value = jsonData.summary || "";
      document.getElementById("description").value = jsonData.description || "";
      document.getElementById("example").value = jsonData.example || "";
      document.getElementById("constraints").value = jsonData.constraints || "";
      if(typeof jsonData.testcases === "string") {
        JSON.parse(jsonData.testcases);
        document.getElementById("testcases").value = jsonData.testcases;
      } else if(Array.isArray(jsonData.testcases)) {
        document.getElementById("testcases").value = JSON.stringify(jsonData.testcases, null, 2);
      } else {
        throw new Error("Invalid testcases format");
      }
      if(jsonData.code){
        if(jsonData.code.python){
          skeletons.python = jsonData.code.python;
        }
        if(jsonData.code.c){
          skeletons.c = jsonData.code.c;
        }
        const currentLang = document.getElementById("languageSelect").value;
        document.getElementById("codeEditor").value = currentLang === "python" ? skeletons.python : skeletons.c;
      }
      updateFullTemplate();
      document.getElementById("questionJSON").style.borderColor = "";
      alert("JSON data successfully imported!");
    } catch(e) {
      console.error("JSON import error:", e);
      document.getElementById("questionJSON").style.borderColor = "red";
      document.getElementById("questionJSON").title = e.message;
      alert("Error importing JSON: " + e.message);
    }
  });
  
  document.getElementById("extractBtn").addEventListener("click", () => {
    const lang = document.getElementById("languageSelect").value;
    const code = document.getElementById("codeEditor").value;
    let params = "";
    let returns = "";
    let fnName = "";
    if(lang === "python"){
      const sigRegex = /def\s+(\w+)\s*\(([^)]*)\)/;
      const match = code.match(sigRegex);
      if(match){
        fnName = match[1];
        params = match[2].split(",").map(s => s.trim()).filter(Boolean).join(", ");
      }
      const retRegex = /return\s+(.+)/g;
      let matchRet;
      while(matchRet = retRegex.exec(code)){
        returns += matchRet[1].trim() + " ";
      }
    } else {
      const sigRegex = /(\w+)\s+(\w+)\s*\(([^)]*)\)/;
      const match = code.match(sigRegex);
      if(match){
        fnName = match[2];
        params = match[3].split(",").map(s => s.trim()).filter(Boolean).join(", ");
      }
      returns = "Not specified";
    }
    document.getElementById("paramExtracted").value = params || "Could not detect parameters";
    document.getElementById("returnExtracted").value = returns || "Could not detect return value(s)";
  });
  
  document.getElementById("resetForm").addEventListener("click", () => {
    populateDefaults();
  });
  
  document.getElementById("saveQuestion").addEventListener("click", saveQuestion);
}

async function saveQuestion() {
  const qtVal = document.getElementById("questionType").value;
  const [diff, indexStr] = qtVal.split("-");
  const index = parseInt(indexStr);
  const limits = { easy: 8, medium: 4, hard: 2 };
  
  const { data, error } = await supabaseClient
    .from('Questions')
    .select('*')
    .eq('Type', diff.toUpperCase());
    
  if(error) {
    alert("Error checking question count: " + error.message);
    return;
  }
  if(data.length >= limits[diff] && index > data.length) {
    alert(`Cannot create more than ${limits[diff]} ${diff} questions.`);
    return;
  }
  
  const questionData = {
    Type: diff.toUpperCase(),
    Title: document.getElementById("title").value,
    Summary: document.getElementById("summary").value,
    Description: document.getElementById("description").value,
    Example: document.getElementById("example").value,
    Constraints: document.getElementById("constraints").value,
    Test_Cases: document.getElementById("testcases").value,
    Comparison_Type: document.getElementById("comparisonType").value,
    Skeleton_Python: skeletons.python,
    Skeleton_C: skeletons.c,
    Full_Template_Python: DEFAULT_TEMPLATES.python,
    Full_Template_C: DEFAULT_TEMPLATES.c
  };
  
  if(data && data.length >= index) {
    const existing = data[index - 1];
    const { error: updateError } = await supabaseClient
      .from('Questions')
      .update(questionData)
      .eq('id', existing.id);
    if(updateError) {
      alert("Error updating question: " + updateError.message);
      return;
    }
    alert("Question updated successfully!");
  } else {
    const { error: insertError } = await supabaseClient
      .from('Questions')
      .insert(questionData);
    if(insertError) {
      alert("Error inserting question: " + insertError.message);
      return;
    }
    alert("Question inserted successfully!");
  }
  loadQuestionTypes();
}

async function loadPyodideAndPackages() {
  if(!window.loadPyodide) {
    const pyScript = document.createElement("script");
    pyScript.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
    document.head.appendChild(pyScript);
    await new Promise(resolve => { pyScript.onload = resolve; });
  }
  if(!pyodide) {
    pyodide = await loadPyodide();
  }
}