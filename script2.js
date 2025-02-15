async function saveQuestion() {
    const questionType = document.getElementById('questionType').value;
    const [type, indexStr] = questionType.split('-');
    const index = parseInt(indexStr);
    const limits = { easy: 8, medium: 4, hard: 2 };
  
    const { data: existingData, error: fetchError } = await supabaseClient
      .from('Questions')
      .select('*')
      .eq('Type', type.toUpperCase());
  
    if (fetchError) {
      console.error('Error checking existing question:', fetchError);
      alert('Error saving question: ' + fetchError.message);
      return;
    }
  
    if(existingData.length >= limits[type] && index > existingData.length) {
      alert(`Cannot create more than ${limits[type]} ${type} questions.`);
      return;
    }
  
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
  
    if (existingData && existingData.length >= index) {
      const existingQuestion = existingData[index - 1];
      const { error } = await supabaseClient
        .from('Questions')
        .update(questionData)
        .eq('id', existingQuestion.id);
      if(error) {
        console.error('Detailed error:', error);
        alert('Error updating question: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabaseClient
        .from('Questions')
        .insert(questionData);
      if(error) {
        console.error('Detailed error:', error);
        alert('Error inserting question: ' + error.message);
        return;
      }
    }
  
    alert('Question saved successfully!');
    loadQuestionTypes(); 
  }