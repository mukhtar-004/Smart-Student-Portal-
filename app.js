/* Smart Student Portal - single-file modular-ish app
   - Uses localStorage for persistence
   - Basic client-side authentication (with simple reversible encoding noted as insecure)
   - Features: profile, course CRUD, assignments, submissions (client-side), attendance, grades & GPA, report printing
*/

/* ---------- Utilities ---------- */
const Utils = (function(){
  function uid(prefix='id') {
    return prefix + '_' + Math.random().toString(36).slice(2,9);
  }
  function nowISO(){ return new Date().toISOString(); }
  // Simple "hash" (reversible Base64) - NOT secure. Documented in README.
  function pseudoHash(str){ return btoa(unescape(encodeURIComponent(str))); }
  function pseudoUnhash(s){ try{ return decodeURIComponent(escape(atob(s))); }catch(e){ return ''; } }
  return { uid, nowISO, pseudoHash, pseudoUnhash };
})();

/* ---------- Storage ---------- */
const Store = (function(){
  const KEY = 'smart_student_portal_v1';
  function load(){
    const raw = localStorage.getItem(KEY);
    if(!raw) return getDefaultState();
    try { return JSON.parse(raw); } catch(e) { return getDefaultState(); }
  }
  function save(state){ localStorage.setItem(KEY, JSON.stringify(state)); }
  function getDefaultState(){
    return {
      users: [], // {id, username, email, passwordEncoded, profile:{name,bio,picDataURL}}
      sessions: { currentUserId: null },
      courses: [], // {id, title, instructor, credits, semester, grade}
      assignments: [], // {id, courseId, title, due, points, desc, submissions: [{id, text, fileDataURL, ts}]}
      attendance: [], // {id, courseId, date, status} status: 'present'|'absent'
      preferences: { darkMode: false }
    };
  }
  return { load, save };
})();

/* ---------- App State & UI ---------- */
const App = (function(){
  let state = Store.load();

  // DOM refs
  const refs = {
    authSection: document.getElementById('auth-section'),
    registerForm: document.getElementById('register-form'),
    loginForm: document.getElementById('login-form'),
    showRegisterBtn: document.getElementById('show-register'),
    showLoginBtn: document.getElementById('show-login'),
    logoutBtn: document.getElementById('logout-btn'),
    authSectionLogin: document.getElementById('login-form'),
    dashboard: document.getElementById('dashboard'),
    profilePicPreview: document.getElementById('profile-pic-preview'),
    profilePicPreviewSmall: document.getElementById('profile-pic-preview-small'),
    profileNameHeading: document.getElementById('profile-name'),
    profileEmailHeading: document.getElementById('profile-email'),
    navButtons: document.querySelectorAll('.nav-btn'),
    views: document.querySelectorAll('.view'),
    toast: document.getElementById('toast'),
    toggleThemeBtn: document.getElementById('toggle-theme'),
    importBtn: document.getElementById('import-json'),
    exportBtn: document.getElementById('export-json'),
    printBtn: document.getElementById('print-report'),
    // Courses elements
    courseForm: document.getElementById('course-form'),
    coursesTableBody: document.querySelector('#courses-table tbody'),
    filterSemester: document.getElementById('filter-semester'),
    sortCourses: document.getElementById('sort-courses'),
    searchCourses: document.getElementById('search-courses'),
    // Assignments elements
    assignCourseSelect: document.getElementById('assign-course-select'),
    assignmentForm: document.getElementById('assignment-form'),
    assignmentsList: document.getElementById('assignments-list'),
    showAddAssignment: document.getElementById('show-add-assignment'),
    // Attendance
    attCourseSelect: document.getElementById('att-course-select'),
    attDate: document.getElementById('att-date'),
    attendanceList: document.getElementById('attendance-list'),
    markPresentBtn: document.getElementById('mark-present'),
    markAbsentBtn: document.getElementById('mark-absent'),
    // Profile form
    profileForm: document.getElementById('profile-form'),
    profilePicInput: document.getElementById('profile-pic'),
    profileNameInput: document.getElementById('profile-name-input'),
    profileBio: document.getElementById('profile-bio'),
    // Report
    reportContent: document.getElementById('report-content')
  };

  /* ---------- Helpers ---------- */
  function saveState(){ Store.save(state); }
  function toast(msg, time=2500){
    const t = refs.toast;
    t.textContent = msg; t.classList.remove('hidden');
    setTimeout(()=> t.classList.add('hidden'), time);
  }
  function requireAuth(){
    return !!state.sessions.currentUserId;
  }
  function getCurrentUser(){
    return state.users.find(u => u.id === state.sessions.currentUserId) || null;
  }

  /* ---------- Auth ---------- */
  function switchAuthTab(showRegister){
    refs.registerForm.classList.toggle('hidden', !showRegister);
    refs.loginForm.classList.toggle('hidden', showRegister);
    refs.showRegisterBtn.classList.toggle('active', showRegister);
    refs.showLoginBtn.classList.toggle('active', !showRegister);
  }
  function registerHandler(e){
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;

    if(!/\d/.test(password) || password.length < 8){
      toast('Password must include a number and be at least 8 chars');
      return;
    }
    if(password !== password2){ toast('Passwords do not match'); return; }
    if(state.users.some(u => u.email === email)){ toast('Email already registered'); return; }

    const id = Utils.uid('user');
    const newUser = { id, username, email, passwordEncoded: Utils.pseudoHash(password), profile: { name: username, bio:'', picDataURL:'' }};
    state.users.push(newUser);
    state.sessions.currentUserId = id;
    saveState();
    toast('Registered & logged in');
    enterApp();
  }
  function loginHandler(e){
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const user = state.users.find(u => u.email === email);
    if(!user) { toast('Invalid credentials'); return; }
    if(Utils.pseudoHash(password) !== user.passwordEncoded){ toast('Invalid credentials'); return; }
    state.sessions.currentUserId = user.id;
    saveState();
    toast('Logged in');
    enterApp();
  }
  function logout(){
    state.sessions.currentUserId = null;
    saveState();
    renderAuth();
  }

  /* ---------- Rendering ---------- */
  function renderAuth(){
    refs.dashboard.classList.add('hidden');
    refs.authSection.classList.remove('hidden');
    refs.logoutBtn.hidden = true;
    // clear auth forms
  }
  function enterApp(){
    refs.authSection.classList.add('hidden');
    refs.dashboard.classList.remove('hidden');
    refs.logoutBtn.hidden = false;
    refs.profileEmailHeading.textContent = getCurrentUser().email;
    renderProfile();
    renderCoursesTable();
    populateCourseSelects();
    renderAssignmentsList();
    renderAttendance();
    renderReport();
    applyTheme();
  }

  /* ---------- Profile ---------- */
  function renderProfile(){
    const user = getCurrentUser();
    refs.profileNameHeading.textContent = user.profile.name || user.username;
    refs.profileEmailHeading.textContent = user.email;
    refs.profilePicPreview.src = user.profile.picDataURL || '';
    refs.profilePicPreviewSmall.src = user.profile.picDataURL || '';
    refs.profileNameInput.value = user.profile.name || '';
    refs.profileBio.value = user.profile.bio || '';
  }
  function readFileAsDataURL(file){
    return new Promise((res, rej)=>{
      const fr = new FileReader();
      fr.onload = ()=> res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }
  async function saveProfile(e){
    e.preventDefault();
    const name = refs.profileNameInput.value.trim();
    const bio = refs.profileBio.value.trim();
    const user = getCurrentUser();
    user.profile.name = name;
    user.profile.bio = bio;
    // handle image
    const file = refs.profilePicInput.files[0];
    if(file){
      try{
        const dataUrl = await readFileAsDataURL(file);
        user.profile.picDataURL = dataUrl;
      }catch(err){ console.warn(err); }
    }
    name && (refs.profileNameHeading.textContent = name);
    saveState();
    toast('Profile saved');
    renderProfile();
  }

  /* ---------- Courses ---------- */
  function addCourseHandler(e){
    e.preventDefault();
    const title = document.getElementById('course-title').value.trim();
    const instructor = document.getElementById('course-instructor').value.trim();
    const credits = Number(document.getElementById('course-credits').value) || 0;
    const semester = document.getElementById('course-semester').value;

    const course = { id: Utils.uid('course'), title, instructor, credits, semester, grade: null };
    state.courses.push(course);
    saveState();
    toast('Course added');
    renderCoursesTable();
    populateCourseSelects();
    document.getElementById('course-title').value = '';
  }

  function renderCoursesTable(){
    const tbody = refs.coursesTableBody;
    tbody.innerHTML = '';
    let list = state.courses.slice();

    // filter
    const filter = refs.filterSemester.value;
    if(filter) list = list.filter(c => c.semester === filter);
    // search
    const q = refs.searchCourses.value.trim().toLowerCase();
    if(q) list = list.filter(c => c.title.toLowerCase().includes(q) || (c.instructor||'').toLowerCase().includes(q));

    // sort
    const sortBy = refs.sortCourses.value;
    list.sort((a,b) => sortBy === 'credits' ? (b.credits - a.credits) : a.title.localeCompare(b.title));

    list.forEach(c=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(c.title)}</td>
        <td>${escapeHtml(c.instructor || '')}</td>
        <td>${c.credits}</td>
        <td>${escapeHtml(c.semester)}</td>
        <td>${c.grade ?? ''}</td>
        <td>
          <button data-id="${c.id}" class="edit-course">Edit</button>
          <button data-id="${c.id}" class="del-course">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // attach handlers
    tbody.querySelectorAll('.del-course').forEach(btn => btn.onclick = (e)=>{
      const id = e.target.dataset.id;
      state.courses = state.courses.filter(x=>x.id!==id);
      // also remove assignments & attendance for course
      state.assignments = state.assignments.filter(a=>a.courseId!==id);
      state.attendance = state.attendance.filter(a=>a.courseId!==id);
      saveState(); renderCoursesTable(); populateCourseSelects(); renderAssignmentsList(); renderAttendance();
      toast('Course removed');
    });
    tbody.querySelectorAll('.edit-course').forEach(btn => btn.onclick = (e)=>{
      const id = e.target.dataset.id;
      const c = state.courses.find(x=>x.id===id);
      if(!c) return;
      const newTitle = prompt('Course title', c.title);
      if(newTitle!==null){ c.title = newTitle.trim(); saveState(); renderCoursesTable(); populateCourseSelects(); renderReport(); }
    });
    renderProfile(); // keep profile preview updated
  }

  function populateCourseSelects(){
    const selects = [refs.assignCourseSelect, refs.attCourseSelect];
    selects.forEach(sel=>{
      sel.innerHTML = '';
      const def = document.createElement('option'); def.value=''; def.textContent='-- choose --';
      sel.appendChild(def);
      state.courses.forEach(c=>{
        const opt = document.createElement('option'); opt.value = c.id; opt.textContent = `${c.title} (${c.semester})`;
        sel.appendChild(opt);
      });
    });
  }

  /* ---------- Assignments & Submissions ---------- */
  function showAssignmentForm(){
    refs.assignmentForm.classList.remove('hidden');
  }
  function hideAssignmentForm(){
    refs.assignmentForm.classList.add('hidden');
    // clear
    document.getElementById('assign-title').value='';
    document.getElementById('assign-due').value='';
    document.getElementById('assign-points').value=100;
    document.getElementById('assign-desc').value='';
  }
  function saveAssignmentHandler(e){
    e.preventDefault();
    const courseId = refs.assignCourseSelect.value;
    if(!courseId){ toast('Select a course'); return; }
    const title = document.getElementById('assign-title').value.trim();
    const due = document.getElementById('assign-due').value;
    const points = Number(document.getElementById('assign-points').value) || 0;
    const desc = document.getElementById('assign-desc').value.trim();
    const assignment = { id: Utils.uid('assign'), courseId, title, due, points, desc, submissions: [] };
    state.assignments.push(assignment);
    saveState();
    hideAssignmentForm();
    renderAssignmentsList();
    toast('Assignment added');
  }

  function renderAssignmentsList(){
    refs.assignmentsList.innerHTML = '';
    const courseId = refs.assignCourseSelect.value || (state.courses[0] && state.courses[0].id) || '';
    refs.assignCourseSelect.value = courseId;
    const assignments = state.assignments.filter(a => a.courseId === courseId);
    assignments.forEach(a=>{
      const wrap = document.createElement('div');
      wrap.className = 'card';
      wrap.innerHTML = `<h3>${escapeHtml(a.title)} (${a.points}pt) <small>${a.due||''}</small></h3>
        <p>${escapeHtml(a.desc||'')}</p>
        <div>
          <button data-id="${a.id}" class="submit-ass">Submit</button>
          <button data-id="${a.id}" class="grade-ass">Add Score</button>
        </div>
        <div class="submissions"></div>
      `;
      refs.assignmentsList.appendChild(wrap);
      // submissions list
      const subArea = wrap.querySelector('.submissions');
      a.submissions.forEach(s=>{
        const sdiv = document.createElement('div');
        sdiv.innerHTML = `<div>${escapeHtml(s.text||'')} <em>${s.ts}</em>
          ${s.fileDataURL ? `<a href="${s.fileDataURL}" download="submission">[download]</a>` : ''}
        </div>`;
        subArea.appendChild(sdiv);
      });
    });

    // handlers
    refs.assignmentsList.querySelectorAll('.submit-ass').forEach(btn=>{
      btn.onclick = async (e)=>{
        const id = e.target.dataset.id;
        const assign = state.assignments.find(x=>x.id===id);
        if(!assign) return;
        const text = prompt('Paste your submission text (or leave blank to upload a file):') || '';
        let fileDataURL = '';
        if(!text){
          toast('Upload file using a prompt: choose file from dialog');
          // create file input dynamically
          const fi = document.createElement('input'); fi.type='file';
          fi.onchange = async ()=> {
            const f = fi.files[0];
            if(!f) return;
            try{ fileDataURL = await readFileAsDataURL(f); }catch(err){}
            assign.submissions.push({ id: Utils.uid('sub'), text:'', fileDataURL, ts: Utils.nowISO() });
            saveState(); renderAssignmentsList(); toast('Submitted');
          };
          fi.click();
        } else {
          assign.submissions.push({ id: Utils.uid('sub'), text, fileDataURL:'', ts: Utils.nowISO() });
          saveState(); renderAssignmentsList(); toast('Submitted');
        }
      };
    });

    refs.assignmentsList.querySelectorAll('.grade-ass').forEach(btn=>{
      btn.onclick = (e)=>{
        const id = e.target.dataset.id;
        const assign = state.assignments.find(x=>x.id===id);
        if(!assign) return;
        const course = state.courses.find(c=>c.id===assign.courseId);
        const scoreStr = prompt(`Enter numeric score for assignment "${assign.title}" (0 - ${assign.points})`);
        if(scoreStr==null) return;
        const score = Number(scoreStr);
        if(isNaN(score)){ toast('Invalid number'); return; }
        // Store grade by adding property on assignment
        assign.score = score;
        saveState();
        // Recalculate course grade (weighted by assignment points)
        recalcCourseGrade(assign.courseId);
        renderCoursesTable();
        renderReport();
        toast('Score saved and grades recalculated');
      };
    });
  }

  function recalcCourseGrade(courseId){
    // Weighted average of assignment scores
    const assigns = state.assignments.filter(a => a.courseId === courseId && typeof a.score === 'number');
    if(assigns.length === 0) {
      const c = state.courses.find(x=>x.id===courseId);
      if(c) c.grade = null;
      return;
    }
    const totalPoints = assigns.reduce((s,a)=>s + (a.points||0),0);
    if(totalPoints === 0) return;
    const earned = assigns.reduce((s,a)=>s + ((a.score||0)), 0);
    const pct = (earned / totalPoints) * 100;
    // Map pct to letter grade
    const letter = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
    const c = state.courses.find(x=>x.id===courseId);
    if(c){ c.grade = letter; saveState(); }
  }

  /* ---------- Attendance ---------- */
  function markAttendance(courseId, date, status){
    if(!courseId || !date) { toast('Choose course and date'); return; }
    // Remove if existing same date
    state.attendance = state.attendance.filter(a => !(a.courseId===courseId && a.date===date));
    state.attendance.push({ id: Utils.uid('att'), courseId, date, status });
    saveState();
    renderAttendance();
    renderReport();
    toast('Attendance marked');
  }
  function renderAttendance(){
    const courseId = refs.attCourseSelect.value || (state.courses[0] && state.courses[0].id) || '';
    refs.attCourseSelect.value = courseId;
    const list = state.attendance.filter(a => a.courseId === courseId).sort((a,b)=>a.date.localeCompare(b.date));
    refs.attendanceList.innerHTML = list.map(a => `<div>${a.date} — ${a.status}</div>`).join('') || '<div>No records</div>';
    // stats display
    const stats = calcAttendanceStats();
    // display small summary
    const summary = Object.entries(stats.perCourse).map(([cid,p])=>{
      const c = state.courses.find(x=>x.id===cid);
      return `${c ? c.title : cid}: ${p.present}/${p.total} (${Math.round((p.present/p.total||0)*100)}%)`;
    }).join('<br>') || 'No attendance data';
    refs.attendanceList.insertAdjacentHTML('beforeend', `<hr><div>${summary}</div>`);
  }
  function calcAttendanceStats(){
    const perCourse = {};
    state.attendance.forEach(a=>{
      perCourse[a.courseId] = perCourse[a.courseId] || { present:0, total:0 };
      perCourse[a.courseId].total++;
      if(a.status === 'present') perCourse[a.courseId].present++;
    });
    const overall = { present:0, total:0 };
    Object.values(perCourse).forEach(v => { overall.present += v.present; overall.total += v.total; });
    return { perCourse, overall };
  }

  /* ---------- GPA & Report ---------- */
  function gradeLetterToGPA(letter){
    // Documented mapping: A=4, B=3, C=2, D=1, F=0
    const map = { A:4, B:3, C:2, D:1, F:0 };
    return map[letter] ?? null;
  }
  function calcGPA(){
    // Weighted by credits
    const graded = state.courses.filter(c => c.grade);
    if(graded.length===0) return null;
    let totalPoints=0, totalCredits=0;
    graded.forEach(c=>{
      const gpa = gradeLetterToGPA(c.grade);
      if(gpa === null) return;
      totalPoints += gpa * (c.credits || 0);
      totalCredits += (c.credits || 0);
    });
    if(totalCredits === 0) return null;
    return (totalPoints / totalCredits);
  }
  function renderReport(){
    const user = getCurrentUser();
    const attendanceStats = calcAttendanceStats();
    const gpa = calcGPA();
    const coursesHtml = state.courses.map(c=>{
      const att = attendanceStats.perCourse[c.id] || { present:0, total:0 };
      const attPct = att.total ? Math.round(att.present / att.total * 100) : 0;
      return `<tr><td>${escapeHtml(c.title)}</td><td>${c.credits}</td><td>${c.grade ?? ''}</td><td>${attPct}%</td></tr>`;
    }).join('');
    refs.reportContent.innerHTML = `
      <div>
        <h1>Report Card - ${escapeHtml(user.profile.name)}</h1>
        <p>Email: ${escapeHtml(user.email)}</p>
        <table><thead><tr><th>Course</th><th>Credits</th><th>Grade</th><th>Attendance</th></tr></thead>
        <tbody>${coursesHtml}</tbody></table>
        <p><strong>GPA:</strong> ${gpa === null ? 'N/A' : gpa.toFixed(2)}</p>
      </div>
    `;
  }

  /* ---------- Import / Export JSON ---------- */
  function exportJSON(){
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'smart_student_data.json'; a.click();
    URL.revokeObjectURL(url);
  }
  function importJSON(){
    const fi = document.createElement('input'); fi.type='file'; fi.accept='application/json';
    fi.onchange = ()=>{
      const f = fi.files[0]; if(!f) return;
      const fr = new FileReader();
      fr.onload = ()=>{
        try{
          const imported = JSON.parse(fr.result);
          // Simple merge strategy: replace entire state but keep current user's password safety note
          state = imported;
          Store.save(state);
          toast('Imported data (state replaced)');
          // refresh UI
          if(state.sessions.currentUserId) enterApp(); else renderAuth();
        }catch(e){
          toast('Invalid JSON');
        }
      };
      fr.readAsText(f);
    };
    fi.click();
  }

  /* ---------- Theme ---------- */
  function applyTheme(){
    if(state.preferences.darkMode) document.body.classList.add('dark'); else document.body.classList.remove('dark');
  }
  function toggleTheme(){
    state.preferences.darkMode = !state.preferences.darkMode;
    saveState();
    applyTheme();
  }

  /* ---------- Utility small helpers ---------- */
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

  /* ---------- Bind UI ---------- */
  function bind(){
    refs.showRegisterBtn.onclick = ()=> switchAuthTab(true);
    refs.showLoginBtn.onclick = ()=> switchAuthTab(false);
    refs.registerForm.onsubmit = registerHandler;
    refs.loginForm.onsubmit = loginHandler;
    refs.logoutBtn.onclick = logout;
    refs.courseForm.onsubmit = addCourseHandler;
    refs.filterSemester.onchange = renderCoursesTable;
    refs.sortCourses.onchange = renderCoursesTable;
    refs.searchCourses.oninput = renderCoursesTable;
    refs.showAddAssignment.onclick = showAssignmentForm;
    refs.assignmentForm.onsubmit = saveAssignmentHandler;
    document.getElementById('cancel-assign').onclick = hideAssignmentForm;
    refs.assignCourseSelect.onchange = renderAssignmentsList;
    refs.attCourseSelect.onchange = renderAttendance;
    refs.markPresentBtn.onclick = ()=> markAttendance(refs.attCourseSelect.value, refs.attDate.value, 'present');
    refs.markAbsentBtn.onclick = ()=> markAttendance(refs.attCourseSelect.value, refs.attDate.value, 'absent');
    refs.profileForm.onsubmit = saveProfile;
    refs.profilePicInput.onchange = async (e)=>{
      const f = e.target.files[0];
      if(!f) return;
      try{
        const d = await readFileAsDataURL(f);
        refs.profilePicPreviewSmall.src = d;
      }catch(err){}
    };
    refs.toggleThemeBtn.onclick = toggleTheme;
    refs.exportBtn.onclick = exportJSON;
    refs.importBtn.onclick = importJSON;
    refs.printBtn.onclick = ()=> window.print();
    // nav
    document.querySelectorAll('.nav-btn').forEach(btn=>{
      btn.onclick = (e)=>{
        document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
        e.target.classList.add('active');
        const v = e.target.dataset.view;
        document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));
        document.getElementById('view-' + v).classList.remove('hidden');
      };
    });
    // On load, show register tab by default
    switchAuthTab(true);
  }

  /* ---------- Init ---------- */
  function init(){
    bind();
    // If there is a logged-in user, open dashboard
    if(requireAuth()) enterApp(); else renderAuth();
  }

  return { init, state, saveState };
})();

/* ---------- Start app ---------- */
document.addEventListener('DOMContentLoaded', ()=> App.init());