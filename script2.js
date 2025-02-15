async function loadQuestionData(questionType) {
  const [type, num] = questionType.split('-');
  
  const { data: questions, error } = await supabaseClient
    .from('Questions')
    .select('*')
    .eq('Type', type.toUpperCase())
    .limit(1)
    .single();

  if (error || !questions) {
    console.error('Error loading question:', error);
    return;
  }

  document.getElementById('title').value = questions.Title;
  document.getElementById('summary').value = questions.Summary;
  document.getElementById('description').value = questions.Description;
  document.getElementById('example').value = questions.Example;
  document.getElementById('constraints').value = questions.Constraints;
  document.getElementById('testcases').value = questions.Test_Cases;
  document.getElementById('comparisonType').value = questions.Comparison_Type || 'exact';
  
  skeletons.python = questions.Skeleton_Python || skeletons.python;
  skeletons.c = questions.Skeleton_C || skeletons.c;

  languageSelect.value = 'python';
  codeEditor.value = skeletons.python;
  
  if (questions.Full_Template_Python) {
    fullTemplateEditor.value = questions.Full_Template_Python;
  }

  languageSelect.value = 'c';
  codeEditor.value = skeletons.c;

  if (questions.Full_Template_C) {
    fullTemplateEditor.value = questions.Full_Template_C;
  }

  languageSelect.value = 'python';
  codeEditor.value = skeletons.python;
  
  updateFullTemplate();

  templateModified = { python: false, c: false };
}

async function saveQuestion() {
  const questionType = document.getElementById('questionType').value;
  const [type] = questionType.split('-');
  
  const questionData = {
    Type: type.toUpperCase(),
    Title: document.getElementById('title').value,
    Summary: document.getElementById('summary').value,
    Description: document.getElementById('description').value,
    Example: document.getElementById('example').value,
    Constraints: document.getElementById('constraints').value,
    Test_Cases: document.getElementById('testcases').value,
    Comparison_Type: document.getElementById('comparisonType').value,
    Skeleton_Python: skeletons.python,
    Skeleton_C: skeletons.c,
    Full_Template_Python: DEFAULT_TEMPLATES.python,
    Full_Template_C: DEFAULT_TEMPLATES.c
  };

  const { error } = await supabaseClient
    .from('Questions')
    .upsert(questionData, { 
      onConflict: 'Type' 
    });

  if (error) {
    alert('Error saving question: ' + error.message);
    return;
  }

  alert('Question saved successfully!');
  initQuestionTypes(); 
}

async function initQuestionTypes() {
  const { data: questions, error } = await supabaseClient
    .from('Questions')
    .select('Type');

  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }

  questionCounts = {
    easy: 0,
    medium: 0,
    hard: 0
  };

  questions.forEach(q => {
    const type = q.Type.toLowerCase();
    if (type in questionCounts) {
      questionCounts[type]++;
    }
  });

  const questionTypeSelect = document.getElementById('questionType');
  questionTypeSelect.innerHTML = '';

  Object.entries(QUESTION_LIMITS).forEach(([type, limit]) => {
    for (let i = 1; i <= limit; i++) {
      const option = document.createElement('option');
      const isExisting = i <= questionCounts[type];
      option.value = `${type}-${i}`;
      option.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)}-${i}`;
      option.disabled = !isExisting && i !== questionCounts[type] + 1;
      questionTypeSelect.appendChild(option);
    }
  });

  updateDifficultyFromType();
}

insertJSONBtn.addEventListener("click", () => {
  let jsonData;
  try {
    jsonData = JSON.parse(questionJSON.value);
    
    const requiredFields = ['title', 'summary', 'description', 'example', 'constraints', 'testcases'];
    const missingFields = requiredFields.filter(field => !jsonData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    document.getElementById("title").value = jsonData.title || "";
    document.getElementById("summary").value = jsonData.summary || "";
    document.getElementById("description").value = jsonData.description || "";
    document.getElementById("example").value = jsonData.example || "";
    document.getElementById("constraints").value = jsonData.constraints || "";
    
    if (typeof jsonData.testcases === 'string') {
      try {
        JSON.parse(jsonData.testcases); 
        document.getElementById("testcases").value = jsonData.testcases;
      } catch (e) {
        throw new Error('Invalid testcases JSON format');
      }
    } else if (Array.isArray(jsonData.testcases)) {
      document.getElementById("testcases").value = JSON.stringify(jsonData.testcases, null, 2);
    } else {
      throw new Error('Testcases must be a JSON string or array');
    }

    if (jsonData.code) {
      if (jsonData.code.python) {
        skeletons.python = jsonData.code.python;
      }
      if (jsonData.code.c) {
        skeletons.c = jsonData.code.c;
      }
      
      const currentLang = languageSelect.value;
      codeEditor.value = jsonData.code[currentLang];
    }

    questionJSON.style.borderColor = "";
    questionJSON.title = "";
    
    updateFullTemplate();
    
    alert('JSON data successfully imported!');
    
  } catch (e) {
    console.error('JSON import error:', e);
    questionJSON.style.borderColor = "red";
    questionJSON.title = e.message;
    alert('Error importing JSON: ' + e.message);
    return;
  }
});

languageSelect.addEventListener("change", () => {
  const lang = languageSelect.value;
  codeEditor.value = skeletons[lang];
  updateFullTemplate();
});