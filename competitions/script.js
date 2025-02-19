if (localStorage.getItem('banned')) {
  alert('Your team has been banned for cheating attempts');
  window.location.href = 'https://codepit.pages.dev/banned';
}

let isFullscreen = false;
let fullscreenWarningShown = false;
let warningCount = 0;
let lastActiveTime = Date.now();

window.addEventListener('blur', (e) => {
  const activeElement = document.activeElement;
  const isCompilerIframe = activeElement && activeElement.tagName === 'IFRAME' && 
                          activeElement.classList.contains('compiler-iframe');
  
  if (!isCompilerIframe) {
    handleCheatingAttempt('focus');
  }
});

document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('focus', () => {
  lastActiveTime = Date.now();
});

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
  isFullscreen = checkFullscreen();
  if (!isFullscreen) {
    handleCheatingAttempt('fullscreen');
    showFullscreenWarning(); 
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    handleCheatingAttempt('visibility');
  }
}

function handleCheatingAttempt(type = 'general') {
  warningCount++;
  console.log(`Cheating attempt detected (${type}). Warning count: ${warningCount}`);

  if (warningCount === 1) {
    showWarningModal('First warning: Suspicious activity detected');
  } else if (warningCount === 2) {
    showWarningModal('Second warning: Current question marked as failed. Points will be deducted if already solved.');
    markCurrentQuestionFailed();
  } else if (warningCount >= 3) {
    localStorage.setItem('banned', 'true');
    showWarningModal('Final warning: Test cancelled. Your team has been banned.');
    setTimeout(() => {
      window.location.href = 'https://codepit.pages.dev/banned';
    }, 3000);
  }
}

document.addEventListener('copy', (e) => {
  const target = e.target;
  if (!target || !target.matches) return;
  if (!target.matches('#monaco-editor *')) {
    e.preventDefault();
    return false;
  }
});

document.addEventListener('paste', (e) => {
  const target = e.target;
  if (!target || !target.matches) return;
  if (!target.matches('#monaco-editor *')) {
    e.preventDefault();
    return false;
  }
});

document.addEventListener('cut', (e) => {
  const target = e.target;
  if (!target || !target.matches) return;
  if (!target.matches('#monaco-editor *')) {
    e.preventDefault();
    return false;
  }
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey && e.shiftKey && e.key === 'I') || 
      (e.ctrlKey && e.shiftKey && e.key === 'C') || 
      (e.ctrlKey && e.shiftKey && e.key === 'J') || 
      (e.ctrlKey && e.key === 'U') ||           
      e.key === 'F12') {                           
    e.preventDefault();
    return false;
  }
});

document.addEventListener('selectstart', (e) => {
  const target = e.target;
  if (!target || !target.matches) return;
  if (!target.matches('#monaco-editor *')) {
    e.preventDefault();
    return false;
  }
});

document.addEventListener('dragstart', (e) => {
  e.preventDefault();
  return false;
});

window.addEventListener('beforeunload', (e) => {
  e.preventDefault();
  e.returnValue = '';
});

function checkFullscreen() {
  return document.fullscreenElement || 
         document.webkitFullscreenElement || 
         document.mozFullScreenElement || 
         document.msFullscreenElement;
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  if (!checkFullscreen()) {
    showFullscreenWarning();
    return;
  }
  
  const teamName = document.getElementById('teamName').value;
  const password = document.getElementById('password').value;

  if (!teamName || !password) {
    showError('Please enter both team name and password');
    return;
  }

  try {
    const { data, error } = await supabaseClient.rpc('verify_user', {
      input_username: teamName,
      input_password: password,
    });

    if (error) throw error;

    if (data) {
      const competitionReady = await checkCompetitionStatus();

      if (competitionReady) {
        const { error: deleteError } = await supabaseClient
          .from('competitions')
          .delete()
          .eq('username', teamName);

        if (deleteError) throw deleteError;

        const { error: insertError } = await supabaseClient
          .from('competitions')
          .insert([{ 
            username: teamName, 
            points: 0,
            last_points_at: new Date().toISOString()
          }]);

        if (insertError) throw insertError;

        sessionStorage.setItem('teamName', teamName);
        sessionStorage.setItem('userId', data);

        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('rulesScreen').style.display = 'flex';
      }
    } else {
      showError('Invalid team name or password');
    }
  } catch (err) {
    showError('Login failed: ' + err.message);
  }
});

async function checkCompetitionStatus() {
  try {
    const { data, error } = await supabaseClient.from('Questions').select('*').limit(1);

    if (error || !data || data.length === 0) {
      showWarningModal('Competition has not started yet. Please wait for the organizers.');
      return false;
    }

    return true;
  } catch (err) {
    console.error('Competition status check failed:', err);
    return false;
  }
}

document.getElementById('startBtn').addEventListener('click', async () => {
  if (!checkFullscreen()) {
    showFullscreenWarning();
    return;
  }
  
  const { data, error } = await supabaseClient.from('Questions').select('*');

  if (error || !data || data.length === 0) {
    showWarningModal('Competition has not started yet. Please wait for the organizers.');
    return;
  }

  document.querySelector('.timer-container').style.display = 'flex';
  document.getElementById('compilerBtn').style.display = 'block'; 
  testStartTime = Date.now();
  startTimer();

  setTimeout(() => {
    document.getElementById('endTestBtn').style.display = 'block';
    endTestButtonShown = true;
  }, 60 * 60 * 1000); 

  await loadExamQuestions();
  renderRoundInfo();
  renderQuestionList();

  currentQuestionIndex = 0;
  loadQuestion(currentRound, currentQuestionIndex);
  initializeMonacoEditor();

  document.getElementById('rulesScreen').style.display = 'none';
  document.getElementById('competitionScreen').style.display = 'block';
  document.getElementById('leaderboardBtn').style.display = 'block';

  setTimeout(() => {
    const firstQuestion = examQuestions[currentRound][currentQuestionIndex];
    const lang = document.getElementById('runLanguageSelect').value;

    if (monacoEditor && firstQuestion) {
      monacoEditor.setValue(lang === 'python' ? firstQuestion.Skeleton_Python : firstQuestion.Skeleton_C);
    }
  }, 500);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const timeDiff = Date.now() - lastActiveTime;
    if (timeDiff > 1000) {
      handleCheatingAttempt('tabSwitch');
    }
  }
  lastActiveTime = Date.now();
});

async function handleTabSwitch() {
  warningCount++;

  if (warningCount === 1) {
    showWarningModal('First warning: Tab switching detected');
  } else if (warningCount === 2) {
    showWarningModal(
      'Second warning: Current question marked as failed. Points will be deducted if already solved.'
    );
    await markCurrentQuestionFailed();
  } else if (warningCount === 3) {
    showWarningModal('Final warning: Test cancelled');
    endTest(true);
  }
}

function showWarningModal(message) {
  const modal = document.getElementById('warningModal');
  document.getElementById('warningMessage').textContent = message;
  modal.style.display = 'flex';
}

function showError(message) {
  document.getElementById('loginError').textContent = message;
}

async function markCurrentQuestionFailed() {
  const currentQ = examQuestions[currentRound][currentQuestionIndex];

  if (currentQ) {
    if (currentQ._solved) {
      let pointsToDeduct = 0;
      switch (currentRound) {
        case 'easy':
          pointsToDeduct = -5;
          break;
        case 'medium':
          pointsToDeduct = -15;
          break;
        case 'hard':
          pointsToDeduct = -25;
          break;
      }

      const teamName = sessionStorage.getItem('teamName');

      if (teamName) {
        try {
          const { data, error } = await supabaseClient
            .from('competitions')
            .select('points')
            .eq('username', teamName)
            .single();

          if (error) throw error;

          const newPoints = Math.max(0, (data?.points || 0) + pointsToDeduct);

          const { error: updateError } = await supabaseClient
            .from('competitions')
            .update({ points: newPoints })
            .eq('username', teamName);

          if (updateError) throw updateError;
        } catch (err) {
          console.error('Failed to update points:', err);
        }
      }
    }

    currentQ._failed = true;
    currentQ._solved = false; 
    renderQuestionList();
    renderQuestionProgress();
    renderRoundInfo();
  }
}

function endTest(automatic = false) {
  if (!automatic) {
    showEndTestConfirmation();
  } else {
    redirectToThanks();
  }
}

function showEndTestConfirmation() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';

  const content = document.createElement('div');
  content.className = 'modal-content warning-modal';
  content.innerHTML = `
    <h2>⚠️ End Test Confirmation</h2>
    <p>Are you sure you want to end the test? This action cannot be undone.</p>
    <div class="modal-buttons">
      <button onclick="redirectToThanks()" class="btn-danger">Yes, End Test</button>
      <button onclick="this.closest('.modal').remove()" class="btn-secondary">Cancel</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);
}

function redirectToThanks() {
  window.location.href = 'https://codepit.pages.dev/thanks';
}

function startTimer() {
  const timerDisplay = document.getElementById('timer');
  const testDuration = 90 * 60 * 1000;

  function updateTimer() {
    const now = Date.now();
    const timeElapsed = now - testStartTime;
    const timeRemaining = testDuration - timeElapsed;

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      redirectToThanks();
      return;
    }

    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    
    timerDisplay.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeRemaining < 300000) {
      timerDisplay.classList.add('warning');
    }
  }

  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
}

function initializeMonacoEditor() {
  if (monacoEditor) return;

  require.config({
    paths: {
      vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs',
    },
  });

  require(['vs/editor/editor.main'], function () {
    monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
      value: '',
      language: 'python',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      scrollBeyondLastLine: false,
      padding: { top: 10, bottom: 10 },
    });

    const firstQuestion = examQuestions[currentRound][currentQuestionIndex];
    if (firstQuestion) {
      const lang = document.getElementById('runLanguageSelect').value;
      monacoEditor.setValue(lang === 'python' ? firstQuestion.Skeleton_Python : firstQuestion.Skeleton_C);
    }

    document.getElementById('runLanguageSelect').addEventListener('change', (e) => {
      const lang = e.target.value;

      if (monacoEditor && monacoEditor.getModel()) {
        monaco.editor.setModelLanguage(monacoEditor.getModel(), lang);

        const q = examQuestions[currentRound][currentQuestionIndex];
        if (q) {
          monacoEditor.setValue(lang === 'python' ? q.Skeleton_Python : q.Skeleton_C);
        }
      }
    });
  });
}

async function loadExamQuestions() {
  const { data, error } = await supabaseClient.from('Questions').select('*');

  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }

  examQuestions.easy = data.filter((q) => q.Type.toLowerCase() === 'easy');
  examQuestions.medium = data.filter((q) => q.Type.toLowerCase() === 'medium');
  examQuestions.hard = data.filter((q) => q.Type.toLowerCase() === 'hard');
}

function renderRoundInfo() {
  const roundElem = document.getElementById('currentRound');
  roundElem.textContent =
    currentRound === 'easy'
      ? 'Easy Round'
      : currentRound === 'medium'
      ? 'Medium Round'
      : 'Hard Round';

  const total = examQuestions[currentRound].length;
  const solved = examQuestions[currentRound].filter((q) => q._solved).length;

  document.getElementById('totalCount').textContent = total;
  document.getElementById('solvedCount').textContent = solved;
}

function renderQuestionList() {
  const listElem = document.getElementById('questionList');
  listElem.innerHTML = '';

  const roundSelector = document.createElement('div');
  roundSelector.className = 'round-selector';

  const rounds = ['easy', 'medium', 'hard'];
  rounds.forEach((round) => {
    const btn = document.createElement('button');
    btn.className = `round-btn ${round} ${currentRound === round ? 'active' : ''}`;
    btn.textContent = round.charAt(0).toUpperCase() + round.slice(1);

    if (round === 'medium') {
      const easySolved = examQuestions.easy.filter((q) => q._solved).length;
      btn.disabled = easySolved < Math.ceil(examQuestions.easy.length / 2);
    } else if (round === 'hard') {
      const mediumSolved = examQuestions.medium.filter((q) => q._solved).length;
      btn.disabled = mediumSolved < Math.ceil(examQuestions.medium.length / 2);
    }

    btn.addEventListener('click', () => {
      if (!btn.disabled) {
        currentRound = round;
        currentQuestionIndex = 0;
        loadQuestion(currentRound, currentQuestionIndex);
        renderQuestionList();
      }
    });

    roundSelector.appendChild(btn);
  });
  listElem.appendChild(roundSelector);

  examQuestions[currentRound].forEach((q, idx) => {
    const item = document.createElement('div');
    item.className = 'question-item';
    item.textContent = `${currentRound.charAt(0).toUpperCase() + currentRound.slice(1)} ${idx + 1}`;

    if (q._solved) item.classList.add('solved');
    if (q._failed) item.classList.add('failed');

    item.addEventListener('click', () => {
      if (!q._failed) {
        currentQuestionIndex = idx;
        loadQuestion(currentRound, currentQuestionIndex);
      }
    });

    listElem.appendChild(item);
  });

  renderQuestionProgress();
  renderRoundInfo();
}

function loadQuestion(round, index) {
  const q = examQuestions[round] && examQuestions[round][index];
  if (!q) return;

  document.getElementById('questionTitle').textContent = q.Title || '';
  document.getElementById('questionSummary').textContent = q.Summary || '';
  document.getElementById('questionDescription').textContent = q.Description || '';
  document.getElementById('questionExample').textContent = q.Example || '';
  document.getElementById('questionConstraints').textContent = q.Constraints || '';

  const langSelect = document.getElementById('runLanguageSelect');
  const lang = langSelect.value || 'python';

  if (monacoEditor && monacoEditor.getModel()) {
    monaco.editor.setModelLanguage(monacoEditor.getModel(), lang);
    monacoEditor.setValue(lang === 'python' ? q.Skeleton_Python : q.Skeleton_C);
  }

  document.getElementById('output').textContent = '';
  renderQuestionProgress();
}

function renderQuestionProgress() {
  const progressElem = document.getElementById('questionProgress');
  progressElem.innerHTML = '';

  examQuestions[currentRound].forEach((q, idx) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';

    if (idx === currentQuestionIndex) dot.classList.add('active');
    if (q._solved) dot.classList.add('solved');

    dot.setAttribute('title', `${currentRound.charAt(0).toUpperCase() + currentRound.slice(1)} Question ${
      idx + 1
    }`);
    progressElem.appendChild(dot);
  });
}

document.getElementById('runBtn').addEventListener('click', async () => {
  const runLang = document.getElementById('runLanguageSelect').value;
  const question = examQuestions[currentRound][currentQuestionIndex];
  let userCode = monacoEditor ? monacoEditor.getValue() : '';

  let fullTemplate = buildFullTemplate(question, runLang, userCode);

  document.getElementById('output').innerHTML = '<div class="loader"></div>';

  if (runLang === 'python') {
    await runPython(fullTemplate, question);
  } else if (runLang === 'c') {
    await runC(fullTemplate, question);
  }
});

document.getElementById('prevQuestion').addEventListener('click', () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    loadQuestion(currentRound, currentQuestionIndex);
  }
});

document.getElementById('nextQuestion').addEventListener('click', () => {
  if (currentQuestionIndex < examQuestions[currentRound].length - 1) {
    currentQuestionIndex++;
    loadQuestion(currentRound, currentQuestionIndex);
  }
});

function buildFullTemplate(question, lang, userSolution) {
  let template = '';
  let testCases, functionName;

  try {
    testCases = JSON.parse(question.Test_Cases);
  } catch (e) {
    testCases = [];
  }

  if (lang === 'python') {
    const sigRegex = /def\s+(\w+)\s*\(/;
    const match = userSolution.match(sigRegex);
    functionName = match ? match[1] : 'function';
  } else {
    const sigRegex = /(\w+)\s+(\w+)\s*\(/;
    const match = userSolution.match(sigRegex);
    functionName = match ? match[2] : 'function';
  }

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
`,
  };

  template = DEFAULT_TEMPLATES[lang];
  template = template.replace(/<<FUNCTION_NAME>>/g, functionName);

  if (lang === 'python') {
    template = template.replace('<<TEST_CASES>>', JSON.stringify(testCases, null, 2));
  } else {
    let testCaseCode = '';
    testCases.forEach((tc, idx) => {
      const paramName = `test_input_${idx + 1}`;
      testCaseCode += `
  // Test case ${idx + 1}
  char ${paramName}[256];
  strcpy(${paramName}, "${tc.params[0]}");
  int result_${idx + 1} = ${functionName}(${paramName});
  if(compare_value(result_${idx + 1}, ${tc.expected})) passCount++;
`;
    });

    template = template.replace('<<TEST_COUNT>>', testCases.length);
    template = template.replace('<<TEST_CASES>>', testCaseCode);
  }

  const parts = template.split('/* USER SOLUTION HERE */');
  if (parts.length >= 2) {
    template = parts[0] + userSolution + parts[1];
  }

  return template;
}

async function loadPyodideAndPackages() {
  try {
    if (!window.loadPyodide) {
      console.error('Pyodide loader not found');
      return null;
    }
    const py = await window.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
    });
    return py;
  } catch (error) {
    console.error('Failed to load Pyodide:', error);
    return null;
  }
}

async function runPython(fullCode, question) {
  const outputElem = document.getElementById('output');

  try {
    if (!pyodide) {
      outputElem.textContent = 'Loading Pyodide. Please wait...';
      pyodide = await loadPyodideAndPackages();
      if (!pyodide) {
        outputElem.textContent = 'Failed to load Pyodide. Cannot run Python code.';
        return;
      }
    }

    await pyodide.runPythonAsync(fullCode);
    const testResults = await pyodide.globals.get('_test_results').toJs();
    const passed = testResults.filter((t) => t).length;
    const total = testResults.length;

    outputElem.textContent = `Python Test Results: ${passed}/${total} tests passed.`;
    markQuestionSolved(question, passed, total);
  } catch (err) {
    outputElem.textContent = 'Error: ' + err;
    console.error(err);
  }
}

async function runC(fullCode, question) {
  const outputElem = document.getElementById('output');

  try {
    outputElem.textContent = 'Compiling...';
    const response = await fetch('https://c-compile.deno.dev/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: fullCode,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const outputText = await response.text();
    outputElem.textContent = outputText || 'Program finished without output.';

    const regex = /C Test Results:\s*(\d+)\/(\d+)/;
    const m = outputText.match(regex);

    if (m) {
      let passed = parseInt(m[1]);
      let total = parseInt(m[2]);
      markQuestionSolved(question, passed, total);
    }
  } catch (err) {
    outputElem.textContent = 'C Error: ' + err;
    console.error(err);
  }
}

document.getElementById('leaderboardBtn').addEventListener('click', async () => {
  try {
    const { data, error } = await supabaseClient
      .from('competitions')
      .select('username, points, last_points_at')
      .order('points', { ascending: false }) 
      .order('last_points_at', { ascending: true }); 
    if (error || !data || data.length === 0) {
      showFrozenLeaderboardModal();
      return;
    }

    showLeaderboardModal(data);
  } catch (err) {
    showFrozenLeaderboardModal();
    console.error('Failed to fetch leaderboard:', err);
  }
});

function showLeaderboardModal(leaderboardData) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';

  const content = document.createElement('div');
  content.className = 'modal-content leaderboard-content';
  content.innerHTML = `
    <h2><i class="fas fa-trophy"></i> Leaderboard</h2>
    <div class="leaderboard-table">
      <div class="leaderboard-header">
        <span>Team</span>
        <span>Points</span>
      </div>
      ${leaderboardData
        .map(
          (entry, index) => `
        <div class="leaderboard-row ${index < 3 ? 'top-' + (index + 1) : ''}">
          <span>${entry.username}</span>
          <span>${entry.points}</span>
        </div>
      `
        )
        .join('')}
    </div>
    <button onclick="this.closest('.modal').remove()" class="btn-primary">Close</button>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);
}

function showFrozenLeaderboardModal() {
  const modal = document.getElementById('frozenLeaderboardModal');
  modal.style.display = 'flex';
}

async function markQuestionSolved(question, passed, total) {
  const solved = passed >= Math.ceil(total / 2);
  const idx = examQuestions[currentRound].findIndex((q) => q === question);

  if (idx !== -1) {
    if (examQuestions[currentRound][idx]._failed) {
      return;
    }

    if (solved && !examQuestions[currentRound][idx]._solved) {
      let pointsToAdd = 0;
      switch (currentRound) {
        case 'easy':
          pointsToAdd = 5;
          break;
        case 'medium':
          pointsToAdd = 15;
          break;
        case 'hard':
          pointsToAdd = 25;
          break;
      }

      const teamName = sessionStorage.getItem('teamName');

      if (teamName) {
        try {
          const { data, error } = await supabaseClient
            .from('competitions')
            .select('points')
            .eq('username', teamName)
            .single();

          if (error) throw error;

          const newPoints = (data?.points || 0) + pointsToAdd;

          const { error: updateError } = await supabaseClient
            .from('competitions')
            .update({ 
              points: newPoints,
              last_points_at: new Date().toISOString() 
            })
            .eq('username', teamName);

          if (updateError) throw updateError;
        } catch (err) {
          console.error('Failed to update points:', err);
        }
      }
    }

    examQuestions[currentRound][idx]._solved = solved;
  }

  renderQuestionList();
  renderQuestionProgress();
  renderRoundInfo();
  checkRoundAdvance();
}

function checkRoundAdvance() {
  renderRoundInfo();
  renderQuestionList();
}

window.enterFullscreen = enterFullscreen;
window.showEndTestConfirmation = showEndTestConfirmation;

const SUPABASE_URL = 'https://vekkziumelqjndunkpxj.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZla2t6aXVtZWxxam5kdW5rcHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2MTE3MzgsImV4cCI6MjA1NTE4NzczOH0.XWPYixmR7C_TOLh0Ai7HFmGU07Sa2ryZxeEqrd4zwGg';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentRound = 'easy';
let rounds = { easy: { limit: 8 }, medium: { limit: 4 }, hard: { limit: 2 } };
let examQuestions = { easy: [], medium: [], hard: [] };
let currentQuestionIndex = 0;
let monacoEditor = null;
let pyodide = null;
let testStartTime = null;
let timerInterval = null;
let endTestButtonShown = false;

function showFullscreenWarning() {
  const existingWarning = document.querySelector('.fullscreen-warning');
  if (!existingWarning) {
    const warning = document.createElement('div');
    warning.className = 'fullscreen-warning';
    warning.innerHTML = `
      <div class="fullscreen-warning-content">
        <h2>⚠️ Fullscreen Required</h2>
        <p>This application must be run in fullscreen mode. Please click the button below to enter fullscreen mode and continue.</p>
        <button class="btn-fullscreen" onclick="enterFullscreen()">Enter Fullscreen Mode</button>
      </div>
    `;
    document.body.appendChild(warning);
    fullscreenWarningShown = true;
  }
}

async function enterFullscreen() {
  const docElm = document.documentElement;
  try {
    if (docElm.requestFullscreen) {
      await docElm.requestFullscreen();
    } else if (docElm.webkitRequestFullscreen) {
      await docElm.webkitRequestFullscreen();
    } else if (docElm.mozRequestFullScreen) {
      await docElm.mozRequestFullScreen();
    } else if (docElm.msRequestFullscreen) {
      await docElm.msRequestFullscreen();
    }
    const warning = document.querySelector('.fullscreen-warning');
    if (warning) {
      warning.remove();
    }
    fullscreenWarningShown = false;
  } catch (err) {
    console.error('Failed to enter fullscreen:', err);
  }
}

document.getElementById('compilerBtn').addEventListener('click', () => {
  const modal = document.getElementById('compilerModal');
  modal.style.display = 'flex';
});

document.getElementById('closeCompiler').addEventListener('click', () => {
  const modal = document.getElementById('compilerModal');
  modal.style.display = 'none';
});