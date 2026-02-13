/**********************************************************
  GLOBAL STATE
**********************************************************/
let role = "Software Engineer";
let careerLevel = "Fresher";
let activeResumeText = "";
let lastAnalysis = null;
let AI_PROVIDER = localStorage.getItem("AI_PROVIDER") || "openai";

/**********************************************************
  CREDITS / MONETIZATION
**********************************************************/
const FREE_CREDITS = 3;
const AI_CREDIT_COST = 1;

function getCredits() {
  if (!localStorage.getItem("credits")) {
    localStorage.setItem("credits", FREE_CREDITS);
  }
  return parseInt(localStorage.getItem("credits"));
}

function consumeCredit() {
  let c = getCredits();
  if (c <= 0) {
    openPricing();
    return false;
  }
  localStorage.setItem("credits", c - AI_CREDIT_COST);
  return true;
}

function buyCredits(amount) {
  const total = getCredits() + amount;
  localStorage.setItem("credits", total);
  alert(`✅ ${amount} credits added\nTotal credits: ${total}`);
  closePricing();
}

/**********************************************************
  PAGE NAVIGATION
**********************************************************/
function openPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

/**********************************************************
  ROLE & CAREER
**********************************************************/
function selectRole(r) {
  role = r;
  updateBadge();
}

function selectCareer(level) {
  careerLevel = level;
  updateBadge();
}

function updateBadge() {
  const el = document.getElementById("currentRole");
  if (el) el.innerText = `${role} • ${careerLevel}`;
}

/**********************************************************
  ROLE SKILL MAP
**********************************************************/
const roleSkills = {
  "Software Engineer": {
    Fresher: ["HTML", "CSS", "JavaScript", "Git", "SQL"],
    Mid: ["React", "Node", "API", "Testing"],
    Senior: ["System Design", "Scalability", "Cloud"]
  },
  "AI / ML Engineer": {
    Fresher: ["Python", "NumPy", "Pandas", "Machine Learning"],
    Mid: ["TensorFlow", "Model Training"],
    Senior: ["Deployment", "Optimization"]
  },
  "Civil Engineer": {
    Fresher: ["AutoCAD", "Drawing"],
    Mid: ["Estimation", "Site Work"],
    Senior: ["Planning", "Project Management"]
  }
};

/**********************************************************
  TEXT UTILITIES
**********************************************************/
const normalize = t => t.toLowerCase();
const unique = arr => [...new Set(arr)];

function extractMatchedSkills(text, expected) {
  return expected.filter(skill =>
    text.includes(skill.toLowerCase())
  );
}

/**********************************************************
  SECTION DETECTION
**********************************************************/
function detectSections(text) {
  return {
    Education: /education/i.test(text),
    Skills: /skills/i.test(text),
    Experience: /experience|internship/i.test(text),
    Projects: /project/i.test(text)
  };
}

/**********************************************************
  BULLET QUALITY
**********************************************************/
const actionVerbs = [
  "built", "developed", "designed", "implemented",
  "optimized", "created", "led", "improved"
];

function analyzeBullets(text) {
  const lines = text.split("\n").filter(l => l.trim().length > 8);
  let strong = 0;
  lines.forEach(line => {
    const hasVerb = actionVerbs.some(v => line.toLowerCase().includes(v));
    const hasNumber = /\d+/.test(line);
    if (hasVerb && hasNumber) strong++;
  });
  return { total: lines.length, strong };
}

/**********************************************************
  ATS SCORE
**********************************************************/
function atsScore(text) {
  let score = 0;
  if (text.length < 8000) score += 10;
  if (!/[#@]/.test(text)) score += 10;
  if (/education|skills|experience/i.test(text)) score += 10;
  return score;
}

/**********************************************************
  RESUME ANALYSIS
**********************************************************/
function analyzeResume() {
  const input = document.getElementById("resumeText")?.value || activeResumeText;
  const out = document.getElementById("analysisOutput");
  if (!input) {
    out.innerHTML = "❌ Please paste your resume first";
    return;
  }

  const text = normalize(input);
  const expectedSkills = [
    ...roleSkills[role]["Fresher"],
    ...(roleSkills[role][careerLevel] || [])
  ];

  const matched = extractMatchedSkills(text, expectedSkills);
  const missing = expectedSkills.filter(s => !matched.includes(s));
  const sections = detectSections(text);
  const bullets = analyzeBullets(input);

  let score = 0;
  score += matched.length * 6;
  score += bullets.strong * 6;
  score += Object.values(sections).filter(Boolean).length * 5;
  score += atsScore(text);
  score = Math.min(100, score);

  lastAnalysis = { role, careerLevel, score, matched, missing, bullets, sections };

  out.innerHTML = `
    <h2>🎯 Resume Score: ${score}/100</h2>
    <p><b>✅ Skills Found</b><br>${matched.length ? matched.join(", ") : "No key skills detected"}</p>
    <p><b>❌ Skills to Add</b><br>${missing.join(", ")}</p>
    <p><b>✍ Strong Bullets</b><br>${bullets.strong} out of ${bullets.total}</p>
    <p><b>📄 ATS Compatibility</b><br>${atsScore(text) >= 20 ? "✅ Likely to pass ATS" : "⚠ Needs improvement"}</p>
    <button onclick="runAIReview()">🤖 AI Resume Feedback</button>
    <button onclick="generateSkillRoadmap()">🛣 Skill Roadmap</button>
  `;
}

/**********************************************************
  AI CONFIG
**********************************************************/
const AI_MODEL = "gpt-4o-mini";

async function callGemini(prompt) {
  const key = localStorage.getItem("GEMINI_KEY");
  if (!key) throw "⚠ Gemini API key missing";
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + key,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠ Gemini error";
}

async function callAI(prompt) {
  if (!consumeCredit()) throw "⚠ No credits left";
  if (AI_PROVIDER === "gemini") return callGemini(prompt);

  const key = localStorage.getItem("AI_KEY");
  if (!key) return alert("⚠ Add AI_KEY in localStorage");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.3 })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "⚠ AI error";
}

/**********************************************************
  AI FEATURES
**********************************************************/
async function runAIReview() {
  const resume = document.getElementById("resumeText").value;
  const result = await callAI(`
Act as a senior recruiter.
Explain strengths, weaknesses, and ATS improvements.
Resume:
${resume}`);
  alert(result);
}

async function generateSkillRoadmap() {
  if (!lastAnalysis) return alert("Analyze resume first");
  const result = await callAI(`
Create a 90-day learning roadmap for:
Role: ${role}
Level: ${careerLevel}
Missing skills: ${lastAnalysis.missing.join(", ")}`);
  alert(result);
}

/**********************************************************
  JD MATCHER
**********************************************************/
async function matchJD() {
  const resume = document.getElementById("resumeText").value;
  const jd = document.getElementById("jdText").value;
  const out = document.getElementById("matchOutput");
  if (!resume || !jd) return out.innerHTML = "❌ Paste both resume and job description";

  const ai = await callAI(`
Compare resume with job description.
Return:
1) Match percentage
2) Missing skills
3) Suggestions
Resume:
${resume}
JD:
${jd}`);
  out.innerHTML = ai.replace(/\n/g, "<br>");
}

/**********************************************************
  BULLET IMPROVER
**********************************************************/
function improveBullets() {
  const text = document.getElementById("bulletText").value;
  const out = document.getElementById("bulletOutput");
  out.innerHTML = text
    .split("\n")
    .map(line => (!/\d+/.test(line) ? "• " + line + " (add measurable impact)" : "• " + line))
    .join("<br>");
}

/**********************************************************
  PRICING MODAL
**********************************************************/
function openPricing() { document.getElementById("pricingModal")?.classList.add("show"); }
function closePricing() { document.getElementById("pricingModal")?.classList.remove("show"); }

/**********************************************************
  ONBOARDING
**********************************************************/
function closeOnboarding() {
  document.getElementById("onboarding")?.classList.remove("active");
  localStorage.setItem("onboarded", "yes");
}

window.addEventListener("load", () => {
  updateBadge();
  if (!localStorage.getItem("onboarded")) {
    document.getElementById("onboarding")?.classList.add("active");
  }
});

/**********************************************************
  VISUALS: CURSOR GLOW, MATRIX, HEX, PAPER TILT, PARTICLES
**********************************************************/
let glow = document.querySelector(".cursor-glow");
if (!glow) {
  glow = document.createElement("div");
  glow.className = "cursor-glow";
  document.body.appendChild(glow);
}
document.addEventListener("mousemove", e => {
  glow.style.left = e.clientX + "px";
  glow.style.top = e.clientY + "px";
});

// MATRIX
let matrixEl = document.getElementById("matrix");
if (!matrixEl) {
  matrixEl = document.createElement("canvas");
  matrixEl.id = "matrix";
  matrixEl.style.position = "fixed";
  matrixEl.style.top = "0";
  matrixEl.style.left = "0";
  matrixEl.style.width = "100%";
  matrixEl.style.height = "100%";
  matrixEl.style.zIndex = "-9";
  matrixEl.style.pointerEvents = "none";
  document.body.appendChild(matrixEl);
}
const ctx = matrixEl.getContext("2d");
function resizeCanvas() { matrixEl.width = innerWidth; matrixEl.height = innerHeight; }
resizeCanvas(); window.addEventListener("resize", resizeCanvas);
const chars = "01<>/{}[]$#@AI";
const fontSize = 16;
let columns = Math.floor(matrixEl.width / fontSize);
let drops = Array.from({ length: columns }).fill(1);
function drawMatrix() {
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, 0, matrixEl.width, matrixEl.height);
  ctx.fillStyle = "#00ffff"; ctx.font = fontSize + "px monospace";
  drops.forEach((y,i)=>{
    const text = chars[Math.floor(Math.random()*chars.length)];
    ctx.fillText(text, i*fontSize, y*fontSize);
    if (y*fontSize > matrixEl.height && Math.random()>0.975) drops[i]=0;
    drops[i]++;
  });
}
setInterval(drawMatrix,50);

// HEXAGONS
for(let i=0;i<7;i++){
  const hex = document.createElement("div");
  hex.className="hexagon";
  hex.style.left=Math.random()*100+"vw";
  hex.style.animationDuration=(12+Math.random()*12)+"s";
  document.body.appendChild(hex);
}

// 3D PAPER
const paper = document.querySelector(".resume-paper");
if(paper){
  paper.addEventListener("mousemove",e=>{
    const rect=paper.getBoundingClientRect();
    const x=e.clientX-rect.left;
    const y=e.clientY-rect.top;
    paper.style.transform=`rotateX(${((y/rect.height)-0.5)*12}deg) rotateY(${((x/rect.width)-0.5)*-12}deg)`;
  });
  paper.addEventListener("mouseleave",()=>{paper.style.transform="rotateX(0deg) rotateY(0deg)";});
}

// PARTICLES
const particles=[];for(let i=0;i<50;i++){particles.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:2+Math.random()*3,dx:(Math.random()-0.5)*0.5,dy:(Math.random()-0.5)*0.5});}
const canvasParticles=document.createElement("canvas");
canvasParticles.style.position="fixed";canvasParticles.style.top="0";canvasParticles.style.left="0";canvasParticles.style.zIndex="-7";canvasParticles.style.pointerEvents="none";
document.body.appendChild(canvasParticles);const ctxP=canvasParticles.getContext("2d");
function resizeParticles(){canvasParticles.width=innerWidth;canvasParticles.height=innerHeight;}
resizeParticles();window.addEventListener("resize",resizeParticles);
function drawParticles(){ctxP.clearRect(0,0,canvasParticles.width,canvasParticles.height);particles.forEach(p=>{ctxP.fillStyle="rgba(0,255,255,0.3)";ctxP.beginPath();ctxP.arc(p.x,p.y,p.r,0,2*Math.PI);ctxP.fill();p.x+=p.dx;p.y+=p.dy;if(p.x<0||p.x>canvasParticles.width)p.dx*=-1;if(p.y<0||p.y>canvasParticles.height)p.dy*=-1;});requestAnimationFrame(drawParticles);}
drawParticles();

/**********************************************************
  BUTTON FIXES
**********************************************************/
function fixIDs(){
  const pages=[{textarea:"resumeText",output:"analysisOutput"},{textarea:"jdText",output:"matchOutput"},{textarea:"bulletText",output:"bulletOutput"}];
  pages.forEach(p=>{
    if(!document.getElementById(p.textarea)){const ta=document.querySelector(`textarea[placeholder*="${p.textarea.split("Text")[0]}"]`);if(ta)ta.id=p.textarea;}
    if(!document.getElementById(p.output)){const div=document.createElement("div");div.id=p.output;div.style.marginTop="12px";const sec=document.getElementById(p.textarea)?.parentNode;if(sec)sec.appendChild(div);}
  });
}
fixIDs();

document.querySelectorAll(".card").forEach(card=>{
  card.addEventListener("click",()=>{const target=card.querySelector("h3")?.innerText.toLowerCase();
  if(target?.includes("resume analyzer")) openPage("analyze");
  else if(target?.includes("resume vs job")) openPage("matcher");
  else if(target?.includes("fix bullet")) openPage("bullets");});
});

document.querySelectorAll(".hero-actions button").forEach(btn=>{
  btn.addEventListener("click",()=>{if(btn.innerText.toLowerCase().includes("analyze")) openPage("analyze"); else openPage("bullets");});
});

/**********************************************************
  ✅ All-in-one addon fully integrated
**********************************************************/
console.log("✅ Script.js fully updated: buttons, role toggle, AI, visuals, particles, matrix, hex, 3D paper tilt all active.");
// ===== UNIVERSAL RESUME ANALYSIS LOGIC =====

const universalSections = [
  "education",
  "experience",
  "projects",
  "skills",
  "certification",
  "internship",
  "achievement"
];

const roleSkill = {
  "Software Engineer": ["data structures", "algorithms", "oops", "git"],
  "Frontend Engineer": ["html", "css", "javascript", "react"],
  "Backend Engineer": ["node", "java", "sql", "api"],
  "Full Stack Engineer": ["html", "css", "javascript", "node", "react"],
  "AI / ML Engineer": ["python", "machine learning", "deep learning", "tensorflow"],
  "Data Engineer": ["sql", "python", "etl", "data pipeline"],
  "DevOps Engineer": ["docker", "kubernetes", "aws", "ci/cd"],
  "Cloud Engineer": ["aws", "azure", "gcp"],
  "Cybersecurity Engineer": ["network security", "encryption", "linux"],
  "Mobile App Engineer": ["android", "ios", "flutter", "react native"]
};

document.querySelector("#analyze button.primary").addEventListener("click", () => {
  const resumeText = document.querySelector("#analyze textarea").value.toLowerCase();
  if (!resumeText.trim()) {
    alert("Please paste your resume");
    return;
  }

  let ats = 0;
  let skills = 0;
  let experience = 0;
  let suggestions = [];

  // ATS SCORE (sections)
  let foundSections = 0;
  universalSections.forEach(sec => {
    if (resumeText.includes(sec)) foundSections++;
    else suggestions.push(`Add a clear "${sec}" section`);
  });
  ats = Math.min(100, foundSections * 14);

  // ROLE SKILL MATCH
  const selectedRole = candidateRole.innerText;
  if (roleSkills[selectedRole]) {
    const requiredSkills = roleSkills[selectedRole];
    let matched = 0;
    requiredSkills.forEach(skill => {
      if (resumeText.includes(skill)) matched++;
      else suggestions.push(`Consider adding skill: ${skill}`);
    });
    skills = Math.round((matched / requiredSkills.length) * 100);
  } else {
    skills = 40;
  }

  // EXPERIENCE SCORE
  if (resumeText.includes("experience") || resumeText.includes("project")) {
    experience = 80;
  } else {
    experience = 40;
    suggestions.push("Add internships, projects or work experience");
  }

  // SHOW RESULT
  document.getElementById("analysisResult").style.display = "block";
  animateScore("atsScore", ats);
  animateScore("skillScore", skills);
  animateScore("expScore", experience);

  const sugList = document.getElementById("suggestions");
  sugList.innerHTML = "";
  [...new Set(suggestions)].forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    sugList.appendChild(li);
  });
});

// ===== SCORE ANIMATION =====
function animateScore(id, target) {
  let val = 0;
  const el = document.getElementById(id);
  const interval = setInterval(() => {
    val++;
    el.innerText = val + "%";
    if (val >= target) clearInterval(interval);
  }, 15);
}






































