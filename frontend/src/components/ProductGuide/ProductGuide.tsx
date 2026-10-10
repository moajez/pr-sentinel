import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Home,
  Info,
  Sparkles,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Shield,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  ArrowRight,
  BookOpen,
  Search,
  Bell,
  Sun,
  ShieldCheck,
  Zap,
  Lock,
  GitBranch,
  Bot,
  X,
  Send,
  Eye,
  FileText,
  AlertOctagon,
  Cpu,
  Tag,
  CheckSquare,
  Terminal,
  Key,
  Database,
  ArrowUpRight,
  Sliders,
  ShieldAlert
} from "lucide-react";

export default function ProductGuide() {
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<"quick_start" | "how_it_works" | "what_it_detects" | "examples" | "faq">("quick_start");

  // Sample PR review sub-tabs state (1: Review PR, 2: View Findings, 3: Inspect Fix, 4: Policy Decision)
  const [reviewStep, setReviewStep] = useState<1 | 2 | 3 | 4>(1);

  // Selected file in sample PR diff
  const [selectedFile, setSelectedFile] = useState<"queries" | "users" | "schemas">("queries");

  // Code copied state
  const [copiedCode, setCopiedCode] = useState(false);

  // Collapsible explanation inside finding
  const [showProblemExplanation, setShowProblemExplanation] = useState(true);

  // Setup Guide modal state (Required fix: opens complete interactive setup guide rather than navigating to cicd)
  const [showSetupGuideModal, setShowSetupGuideModal] = useState(false);

  // Chat with Sentinel modal state
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ sender: "user" | "sentinel"; text: string }>>([
    {
      sender: "sentinel",
      text: "Hi! I'm Sentinel, your AI security co-pilot. You can ask me how PR Sentinel detects vulnerabilities, how policy enforcement works, or how to install our GitHub App on your test repository!"
    }
  ]);

  // Learning progress checklist states
  const [learningSteps, setLearningSteps] = useState([
    { id: 1, title: "Understand what PR Sentinel does", completed: true },
    { id: 2, title: "Explore sample PR (this page)", completed: true },
    { id: 3, title: "Learn how it works", completed: false, active: true },
    { id: 4, title: "Explore supported security checks", completed: false },
    { id: 5, title: "View real-world examples", completed: false },
    { id: 6, title: "Set up your own repository (optional)", completed: false },
  ]);

  // Expanded FAQ items
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const completedCount = learningSteps.filter((s) => s.completed).length;
  const progressPct = Math.round((completedCount / learningSteps.length) * 100);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    const msg = chatMessage;
    setChatMessage("");
    setChatHistory((prev) => [...prev, { sender: "user", text: msg }]);

    setTimeout(() => {
      let reply = "PR Sentinel runs security checks against code diffs, detects hardcoded secrets and injections, and blocks merges if critical violations fail policy rules.";
      if (msg.toLowerCase().includes("sample") || msg.toLowerCase().includes("pr")) {
        reply = "The Sample PR review below shows an unparameterized SQL concatenation vulnerability (CWE-89) in src/db/queries.py and the exact parameterized fix proposed by PR Sentinel!";
      } else if (msg.toLowerCase().includes("setup") || msg.toLowerCase().includes("install") || msg.toLowerCase().includes("github")) {
        reply = "Click 'View Setup Guide' at the top to see the step-by-step GitHub App configuration guide, webhook secret setup, and branch protection enforcement!";
      } else if (msg.toLowerCase().includes("prompt") || msg.toLowerCase().includes("injection")) {
        reply = "Our AI defense sandbox isolates pull request diffs inside non-executable XML delimiters and validates output against canary tokens to defeat prompt injection.";
      }
      setChatHistory((prev) => [...prev, { sender: "sentinel", text: reply }]);
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BAR (Search Guide, Version, User Avatar)                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Search Guide Input */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Search Guide"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-14 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
          />
          <span className="absolute right-2.5 top-2 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1 rounded shadow-2xs">
            ⌘ K
          </span>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-indigo-700">
            <Tag size={11} /> v2.4 ...
          </span>
          <button className="text-slate-400 hover:text-slate-600 transition p-1">
            <Sun size={16} />
          </button>
          <button className="relative text-slate-400 hover:text-slate-600 transition p-1">
            <Bell size={16} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500"></span>
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              JD
            </div>
            <div className="text-left text-xs leading-none hidden sm:block">
              <div className="font-semibold text-slate-900">John Doe</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Developer</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PAGE TITLE & SENTINEL WELCOME HERO BANNER                              */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Home size={13} className="text-indigo-600" />
            <span>›</span>
            <span className="text-slate-700 font-semibold flex items-center gap-1">
              Product Guide <Info size={12} className="text-slate-400" />
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Understand how PR Sentinel protects your pull requests
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
            Learn the workflow, explore a sample pull request, and see how AI-powered security checks help you catch issues, prevent malicious prompts, and improve code quality — before merge.
          </p>
        </div>

        {/* Mascot Robot Greeting Card */}
        <div className="shrink-0 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 p-4 shadow-xs flex items-center gap-4 max-w-md">
          <div className="w-16 h-16 shrink-0 relative flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-md flex items-center justify-center text-white relative">
              <Bot size={28} className="text-white drop-shadow-sm" />
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse"></div>
            </div>
          </div>

          <div className="text-xs space-y-1">
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1">
              <span>Hi! I'm Sentinel 👋</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              I'll guide you through how PR Sentinel works. Explore the sample PR below or follow the steps to learn more.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. NAVIGATION TABS (QUICK START, HOW IT WORKS, WHAT IT DETECTS, EXAMPLES, FAQ) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab("quick_start")}
          className={`pb-3 px-3 transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === "quick_start"
              ? "border-indigo-600 text-indigo-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sparkles size={14} className={activeTab === "quick_start" ? "text-indigo-600" : "text-slate-400"} />
          <span>Quick Start</span>
        </button>

        <button
          onClick={() => setActiveTab("how_it_works")}
          className={`pb-3 px-3 transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === "how_it_works"
              ? "border-indigo-600 text-indigo-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Cpu size={14} className={activeTab === "how_it_works" ? "text-indigo-600" : "text-slate-400"} />
          <span>How It Works</span>
        </button>

        <button
          onClick={() => setActiveTab("what_it_detects")}
          className={`pb-3 px-3 transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === "what_it_detects"
              ? "border-indigo-600 text-indigo-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Shield size={14} className={activeTab === "what_it_detects" ? "text-indigo-600" : "text-slate-400"} />
          <span>What It Detects</span>
        </button>

        <button
          onClick={() => setActiveTab("examples")}
          className={`pb-3 px-3 transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === "examples"
              ? "border-indigo-600 text-indigo-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileCode size={14} className={activeTab === "examples" ? "text-indigo-600" : "text-slate-400"} />
          <span>Examples</span>
        </button>

        <button
          onClick={() => setActiveTab("faq")}
          className={`pb-3 px-3 transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
            activeTab === "faq"
              ? "border-indigo-600 text-indigo-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <HelpCircle size={14} className={activeTab === "faq" ? "text-indigo-600" : "text-slate-400"} />
          <span>FAQ</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. HERO ACTION BANNER (Try with a Sample Pull Request)                    */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-base text-slate-900">Try PR Sentinel with a Sample Pull Request</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 size={11} /> Local sample · no GitHub connection
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">
              Explore a preloaded example review with simulated sample data. Connect a test repository only after GitHub integration is configured.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setActiveTab("quick_start");
              const el = document.getElementById("sample-review");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
          >
            <span>Explore Sample PR</span>
            <ArrowRight size={13} />
          </button>
          {/* Fixed Setup Guide: Opens detailed in-app setup guide modal */}
          <button
            onClick={() => setShowSetupGuideModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <BookOpen size={13} />
            <span>View Setup Guide</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. TAB 1: QUICK START (MAIN DEFAULT VIEW)                                 */}
      {/* ========================================================================= */}
      {activeTab === "quick_start" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-150">
          {/* LEFT COLUMN: HOW IT WORKS & SAMPLE PULL REQUEST REVIEW (8 COLS) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Section: How PR Sentinel Works */}
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">How PR Sentinel Works</h3>
                <p className="text-xs text-slate-500">
                  From code changes to a safer merge — here's the complete workflow.
                </p>
              </div>

              {/* 4 Connected Workflow Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 relative">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs mb-2">
                      1
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">Connect a test repository (optional)</h4>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                      Install the GitHub App on a test repository to enable automated reviews.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-xs mb-2">
                      2
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">Open a pull request</h4>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                      When a PR is opened, PR Sentinel analyzes the code, comments, and context using security rules and AI models.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-rose-500 text-white font-bold text-xs flex items-center justify-center shadow-xs mb-2">
                      3
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">Review security findings</h4>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                      Findings are posted directly on the PR with clear explanations, severity, and suggested fixes.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs mb-2">
                      4
                    </div>
                    <h4 className="font-bold text-xs text-slate-900">Inspect policy decision</h4>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                      The merge decision is based on your configured security rules, branch protection settings, and compliance policies.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ======================================================================= */}
            {/* Section: Sample Pull Request Review (NOW FULLY INTERACTIVE PER STEP!)  */}
            {/* ======================================================================= */}
            <div id="sample-review" className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden space-y-0">
              {/* Review Card Header */}
              <div className="border-b bg-slate-50/80 px-5 py-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <GitPullRequest size={15} />
                    </div>
                    <h3 className="font-bold text-base text-slate-900">Sample Pull Request Review</h3>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                      Sample review
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                      Illustrative result — not a live scan
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  This is a preloaded example with simulated findings to show how PR Sentinel works. No GitHub connection is required.
                </p>
              </div>

              {/* Review Stage Tabs */}
              <div className="flex items-center border-b border-slate-100 bg-white px-5 text-xs font-semibold overflow-x-auto">
                <button
                  onClick={() => setReviewStep(1)}
                  className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                    reviewStep === 1 ? "border-indigo-600 text-indigo-700 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${reviewStep === 1 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"}`}>1</span>
                  <span>Review PR</span>
                </button>

                <button
                  onClick={() => setReviewStep(2)}
                  className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                    reviewStep === 2 ? "border-indigo-600 text-indigo-700 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${reviewStep === 2 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"}`}>2</span>
                  <span>View Findings (2)</span>
                </button>

                <button
                  onClick={() => setReviewStep(3)}
                  className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                    reviewStep === 3 ? "border-indigo-600 text-indigo-700 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${reviewStep === 3 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"}`}>3</span>
                  <span>Inspect Fix</span>
                </button>

                <button
                  onClick={() => setReviewStep(4)}
                  className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                    reviewStep === 4 ? "border-indigo-600 text-indigo-700 font-bold" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${reviewStep === 4 ? "bg-rose-600 text-white" : "bg-slate-200 text-slate-700"}`}>4</span>
                  <span>Policy Decision (Blocked)</span>
                </button>
              </div>

              {/* STEP 1: REVIEW PR (DIFF VIEW) */}
              {reviewStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100 animate-in fade-in duration-150">
                  {/* Files Changed Sub-panel */}
                  <div className="md:col-span-4 p-4 space-y-3 bg-slate-50/50">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
                      Files Changed (3)
                    </span>

                    <div className="space-y-1">
                      <button
                        onClick={() => setSelectedFile("queries")}
                        className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between transition ${
                          selectedFile === "queries"
                            ? "bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="font-mono text-[11px] truncate">src/db/queries.py</span>
                        <span className="text-[11px] font-mono text-emerald-600 shrink-0 font-bold">+3 -2</span>
                      </button>

                      <button
                        onClick={() => setSelectedFile("users")}
                        className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between transition ${
                          selectedFile === "users"
                            ? "bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="font-mono text-[11px] truncate">src/api/users.py</span>
                        <span className="text-[11px] font-mono text-emerald-600 shrink-0 font-bold">+12 -0</span>
                      </button>

                      <button
                        onClick={() => setSelectedFile("schemas")}
                        className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between transition ${
                          selectedFile === "schemas"
                            ? "bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="font-mono text-[11px] truncate">src/schemas.py</span>
                        <span className="text-[11px] font-mono text-emerald-600 shrink-0 font-bold">+5 -0</span>
                      </button>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                      <span className="font-bold text-slate-800 block">Review Context:</span>
                      <p>PR #42: Add user account retrieval endpoint and database query lookup.</p>
                    </div>
                  </div>

                  {/* Code Diff & Finding Sub-panel */}
                  <div className="md:col-span-8 p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {selectedFile === "queries" ? "src/db/queries.py" : selectedFile === "users" ? "src/api/users.py" : "src/schemas.py"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy('query = "SELECT * FROM users WHERE id = %s"\ncursor.execute(query, (user_id,))')}
                          className="text-slate-400 hover:text-slate-700 p-1 flex items-center gap-1 text-[11px]"
                        >
                          {copiedCode ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          <span>{copiedCode ? "Copied" : "Copy Diff"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Code Diff Display */}
                    <div className="rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto p-3 leading-relaxed">
                      <div className="text-slate-500">10 10  def get_user(user_id):</div>
                      <div className="bg-rose-950/60 text-rose-300 px-1 rounded -mx-1">
                        11 11 -    query = f"SELECT * FROM users WHERE id = &#123;user_id&#125;"
                      </div>
                      <div className="bg-rose-950/60 text-rose-300 px-1 rounded -mx-1">
                        12 12 -    cursor.execute(query)
                      </div>
                      <div className="text-slate-500">13 13 -    return cursor.fetchone()</div>
                      <div className="bg-emerald-950/60 text-emerald-300 px-1 rounded -mx-1">
                        14 14 +    query = "SELECT * FROM users WHERE id = %s"
                      </div>
                      <div className="bg-emerald-950/60 text-emerald-300 px-1 rounded -mx-1">
                        15 15 +    cursor.execute(query, (user_id,))
                      </div>
                      <div className="bg-emerald-950/60 text-emerald-300 px-1 rounded -mx-1">
                        16 16 +    return cursor.fetchone()
                      </div>
                    </div>

                    {/* Finding Preview */}
                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow-2xs">
                            Critical
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 size={11} /> Confidence: 96%
                          </span>
                        </div>
                        <button
                          onClick={() => setReviewStep(2)}
                          className="text-indigo-600 font-semibold hover:underline text-[11px]"
                        >
                          View all 2 findings →
                        </button>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-slate-900">Potential SQL Injection (CWE-89)</h4>
                        <p className="mt-1 text-slate-600 text-xs leading-relaxed">
                          User input is concatenated into the SQL query string. An attacker could inject arbitrary SQL commands.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: VIEW FINDINGS (DETAILED FINDINGS INVENTORY) */}
              {reviewStep === 2 && (
                <div className="p-5 space-y-4 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Security Findings Inventory (2 issues flagged)</h4>
                      <p className="text-slate-500 text-[11px]">Identified by static AST rules and verified dual-pass AI review</p>
                    </div>
                    <span className="rounded bg-rose-100 text-rose-800 px-2.5 py-0.5 font-bold font-mono text-xs">
                      1 Critical · 1 High
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Finding 1 */}
                    <div className="rounded-xl border border-rose-200 bg-white p-4 space-y-2 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Critical</span>
                          <span className="font-bold text-slate-900 text-xs">Potential SQL Injection (CWE-89)</span>
                        </div>
                        <span className="font-mono text-slate-500 text-[11px]">src/db/queries.py:11</span>
                      </div>
                      <p className="text-slate-600 text-xs">
                        Direct string formatting with <code>f"SELECT ... WHERE id = &#123;user_id&#125;"</code> allows SQL parameter breakout.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold">PCI DSS Req 6.2.4</span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold">SOC 2 CC6.1</span>
                        <span className="text-emerald-700 font-semibold text-[11px] ml-auto">96% confidence</span>
                      </div>
                    </div>

                    {/* Finding 2 */}
                    <div className="rounded-xl border border-amber-200 bg-white p-4 space-y-2 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">High</span>
                          <span className="font-bold text-slate-900 text-xs">Hardcoded Database JWT Secret Key (CWE-798)</span>
                        </div>
                        <span className="font-mono text-slate-500 text-[11px]">src/api/users.py:24</span>
                      </div>
                      <p className="text-slate-600 text-xs">
                        High-entropy string matching HMAC-SHA256 secret token format detected directly in code assignment.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold">CWE-798</span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold">SOC 2 CC6.1</span>
                        <span className="text-emerald-700 font-semibold text-[11px] ml-auto">99% confidence (Entropy match)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setReviewStep(3)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      <span>Proceed to Step 3: Inspect Fix Proposal</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: INSPECT FIX (ISOLATED REMEDIATION PROPOSAL) */}
              {reviewStep === 3 && (
                <div className="p-5 space-y-4 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Automated Fix Proposal & Sandbox Verification</h4>
                      <p className="text-slate-500 text-[11px]">Isolated verification confirms tests pass with no model hallucinations</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 font-bold font-mono text-xs flex items-center gap-1">
                      <CheckCircle2 size={13} /> Sandbox Tests Passed
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <span className="font-bold text-slate-800 block text-xs">Proposed Patch Diff:</span>
                    <div className="rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-emerald-300 leading-relaxed overflow-x-auto">
                      <div className="text-slate-500">--- a/src/db/queries.py</div>
                      <div className="text-slate-500">+++ b/src/db/queries.py</div>
                      <div className="bg-rose-950/60 text-rose-300 px-1 -mx-1">- query = f"SELECT * FROM users WHERE id = &#123;user_id&#125;"</div>
                      <div className="bg-rose-950/60 text-rose-300 px-1 -mx-1">- cursor.execute(query)</div>
                      <div className="bg-emerald-950/60 text-emerald-300 px-1 -mx-1">+ query = "SELECT * FROM users WHERE id = %s"</div>
                      <div className="bg-emerald-950/60 text-emerald-300 px-1 -mx-1">+ cursor.execute(query, (user_id,))</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Unit Test Execution</span>
                        <span className="font-mono text-emerald-700 font-bold block">tests/test_queries.py: 3 passed</span>
                        <span className="text-slate-500 text-[11px]">All assertions verified clean in 0.41s</span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Re-scan Verification</span>
                        <span className="font-mono text-emerald-700 font-bold block">0 security findings remaining</span>
                        <span className="text-slate-500 text-[11px]">CWE-89 injection vector fully neutralized</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => handleCopy('query = "SELECT * FROM users WHERE id = %s"\ncursor.execute(query, (user_id,))')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy size={13} />
                      <span>{copiedCode ? "Copied Patch!" : "Copy Suggested Patch"}</span>
                    </button>
                    <button
                      onClick={() => setReviewStep(4)}
                      className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline"
                    >
                      <span>Proceed to Step 4: Policy Decision</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: POLICY DECISION (MERGE GATE BLOCKED STATUS) */}
              {reviewStep === 4 && (
                <div className="p-5 space-y-4 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Branch Protection Policy Decision</h4>
                      <p className="text-slate-500 text-[11px]">Automated merge gate evaluation against repository security policy</p>
                    </div>
                    <span className="rounded-full bg-rose-600 text-white px-3 py-0.5 font-bold font-mono text-xs flex items-center gap-1">
                      <AlertOctagon size={13} /> MERGE BLOCKED
                    </span>
                  </div>

                  {/* Policy Decision Banner */}
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-2 text-rose-950">
                    <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
                      <AlertTriangle size={16} className="text-rose-600" />
                      <span>GitHub Check Run Status: Failed (Action Required)</span>
                    </div>
                    <p className="leading-relaxed text-[11px]">
                      PR Sentinel published check run <code>pr-sentinel/security-check</code> with state <strong>action_required</strong>.
                      Because branch protection requires this check to pass before merging, pull request #42 cannot be merged into <code>main</code> until the Critical SQL Injection finding is resolved or suppressed.
                    </p>
                  </div>

                  {/* Policy Rules Evaluation Matrix */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b">
                        <tr>
                          <th className="px-4 py-2.5">Configured Policy Rule</th>
                          <th className="px-4 py-2.5">Threshold</th>
                          <th className="px-4 py-2.5">Evaluation Result</th>
                          <th className="px-4 py-2.5 text-right">Enforcement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">Block on Critical / High Findings</td>
                          <td className="px-4 py-2.5 font-mono text-slate-600">min_severity: high</td>
                          <td className="px-4 py-2.5 font-semibold text-rose-700">VIOLATED (1 Critical, 1 High)</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-700">BLOCK MERGE</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">Enforce SQL Query Parameterization</td>
                          <td className="px-4 py-2.5 font-mono text-slate-600">PCI DSS Req 6.2.4</td>
                          <td className="px-4 py-2.5 font-semibold text-rose-700">VIOLATED (CWE-89)</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-700">FAIL CHECK</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">AI Prompt Injection Guard</td>
                          <td className="px-4 py-2.5 font-mono text-slate-600">XML Compartmentalization</td>
                          <td className="px-4 py-2.5 font-semibold text-emerald-700">PASSED (No Prompt Hijack)</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">ALLOW</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setReviewStep(1)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      ← Back to Code Diff
                    </button>
                    <button
                      onClick={() => setShowSetupGuideModal(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                    >
                      <span>Configure Policy Rules in Setup Guide</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: PROGRESS, TIPS, AND COMMON USE CASES (4 COLS) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card 1: Learning Progress */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Sparkles size={16} className="text-indigo-600" />
                  <span>Learning progress</span>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {completedCount}/{learningSteps.length} completed
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>
                <div className="text-right text-[10px] font-mono text-slate-400">{progressPct}%</div>
              </div>

              {/* Checklist */}
              <div className="space-y-1.5 text-xs">
                {learningSteps.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setLearningSteps((prev) =>
                        prev.map((item) => (item.id === s.id ? { ...item, completed: !item.completed } : item))
                      );
                      if (s.id === 1) {
                        setActiveTab("how_it_works");
                      } else if (s.id === 2) {
                        setActiveTab("quick_start");
                        setTimeout(() => {
                          document.getElementById("sample-review")?.scrollIntoView({ behavior: "smooth" });
                        }, 50);
                      } else if (s.id === 3) {
                        setActiveTab("how_it_works");
                      } else if (s.id === 4) {
                        setActiveTab("what_it_detects");
                      } else if (s.id === 5) {
                        setActiveTab("examples");
                      } else if (s.id === 6) {
                        setShowSetupGuideModal(true);
                      }
                    }}
                    className="w-full text-left flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition group cursor-pointer"
                  >
                    {s.completed ? (
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : s.active ? (
                      <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        +
                      </div>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 text-slate-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {s.id - 2}
                      </div>
                    )}
                    <span
                      className={`text-[11px] group-hover:underline ${
                        s.completed ? "text-slate-800 font-medium" : s.active ? "text-indigo-700 font-bold" : "text-slate-500"
                      }`}
                    >
                      {s.title}
                    </span>
                  </button>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Quick actions
                </span>

                <button
                  onClick={() => {
                    const el = document.getElementById("sample-review");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white flex items-center justify-center gap-1.5 hover:bg-indigo-700 shadow-xs transition"
                >
                  <span>Explore Sample PR</span>
                  <ArrowRight size={13} />
                </button>

                <button
                  onClick={() => setShowSetupGuideModal(true)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 hover:bg-slate-50 transition"
                >
                  <BookOpen size={13} />
                  <span>Read Setup Guide</span>
                </button>

                <button
                  onClick={() => setShowChatModal(true)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 hover:bg-slate-50 transition"
                >
                  <Bot size={13} className="text-indigo-600" />
                  <span>Chat with Sentinel</span>
                </button>
              </div>
            </div>

            {/* Card 2: Tip from Sentinel */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                  💡
                </div>
                <span>Tip from Sentinel</span>
              </div>
              <p className="text-amber-950 text-[11px] leading-relaxed">
                This sample PR uses preloaded data and does not require a live GitHub connection. You can safely explore findings, explanations, and suggested fixes. Connect a test repository later to try it with your own code.
              </p>
            </div>

            {/* Card 3: Common Use Cases */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <ShieldCheck size={16} className="text-indigo-600" />
                  <span>Common Use Cases</span>
                </div>
                <button
                  onClick={() => setActiveTab("what_it_detects")}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="space-y-2">
                {[
                  "Prevent insecure code from merging",
                  "Detect hidden AI prompt injections",
                  "Enforce compliance (SOC 2, PCI DSS, ISO 27001)",
                  "Improve code quality",
                  "Get safe and actionable fix suggestions",
                ].map((useCase, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-700">
                    <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-[11px]">{useCase}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 2: HOW IT WORKS (COMPLETE PIPELINE ARCHITECTURE)                    */}
      {/* ========================================================================= */}
      {activeTab === "how_it_works" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 animate-in fade-in duration-150">
          <div>
            <h3 className="text-lg font-bold text-slate-900">PR Sentinel Pipeline Architecture</h3>
            <p className="text-xs text-slate-500 mt-1">
              How untrusted pull request events are ingested, sanitized, analyzed, and enforced without security compromise.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center">1</div>
              <h4 className="font-bold text-sm text-slate-900">Signed Webhook Ingestion & HMAC Verification</h4>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                GitHub webhook payloads are cryptographically validated using <code>HMAC-SHA256</code> signatures against your shared webhook secret. Unsigned, tampered, or replayed webhook events are immediately rejected with 401 Unauthorized.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center">2</div>
              <h4 className="font-bold text-sm text-slate-900">AST Diff Parsing & Boundary Containment</h4>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Unified patch diffs are parsed line-by-line into structured AST modifications. Untrusted source code lines, docstrings, and comments are placed inside immutable non-executable XML tags with unique canary tokens to defend against prompt injection.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center">3</div>
              <h4 className="font-bold text-sm text-slate-900">Dual-Pass Security Analysis (Rules + AI)</h4>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Pass 1 applies deterministic regex and AST rules for secrets and known CWE patterns. Pass 2 executes an isolated AI prompt evaluation (gpt-4o) with canary output guards, catching semantic flaws while preventing model prompt hijackings.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white font-bold flex items-center justify-center">4</div>
              <h4 className="font-bold text-sm text-slate-900">Check Run Publishing & Merge Block</h4>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                PR Sentinel publishes a GitHub Check Run (<code>pass</code>, <code>neutral</code>, or <code>action_required</code>) with inline line comments. If configured policies fail, the required GitHub status check blocks merge automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TAB 3: WHAT IT DETECTS (DETECTION TAXONOMY & COMPLIANCE)                */}
      {/* ========================================================================= */}
      {activeTab === "what_it_detects" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 animate-in fade-in duration-150">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Supported Security Detection Taxonomy</h3>
            <p className="text-xs text-slate-500 mt-1">
              PR Sentinel identifies software vulnerabilities, secrets, prompt injections, and compliance violations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <ShieldAlert size={16} className="text-rose-600" />
                <span>Critical Code Flaws (CWE)</span>
              </div>
              <ul className="space-y-1.5 text-slate-600 text-[11px]">
                <li>• <strong>CWE-89</strong>: SQL Injection & Unescaped queries</li>
                <li>• <strong>CWE-79</strong>: Cross-Site Scripting (XSS)</li>
                <li>• <strong>CWE-22</strong>: Path Traversal & Unvalidated file paths</li>
                <li>• <strong>CWE-502</strong>: Insecure Object Deserialization</li>
                <li>• <strong>CWE-285</strong>: Broken Access & Auth Bypass</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <Key size={16} className="text-amber-600" />
                <span>Secrets & Credentials</span>
              </div>
              <ul className="space-y-1.5 text-slate-600 text-[11px]">
                <li>• <strong>AWS Keys</strong>: <code>AKIA...</code> access credentials</li>
                <li>• <strong>Stripe Keys</strong>: <code>sk_live_...</code> payment tokens</li>
                <li>• <strong>Private Keys</strong>: RSA, OpenSSH, PGP headers</li>
                <li>• <strong>JWT Secrets</strong>: Hardcoded symmetric tokens</li>
                <li>• <strong>Database URIs</strong>: Plaintext connection strings</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center gap-2 font-bold text-purple-900">
                <Lock size={16} className="text-purple-600" />
                <span>Prompt Injection Vectors</span>
              </div>
              <ul className="space-y-1.5 text-slate-600 text-[11px]">
                <li>• <strong>Hidden Comments</strong>: HTML/Markdown directives</li>
                <li>• <strong>Base64 Directives</strong>: Encoded payload strings</li>
                <li>• <strong>Zero-Width Breakout</strong>: Unicode delimiter tricks</li>
                <li>• <strong>Docstring Hijacks</strong>: Fake audit clearance text</li>
                <li>• <strong>Config Smuggling</strong>: JSON/YAML instructions</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. TAB 4: EXAMPLES (REAL-WORLD CODE REVIEWS)                              */}
      {/* ========================================================================= */}
      {activeTab === "examples" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 animate-in fade-in duration-150">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Real-World Vulnerability Review Examples</h3>
            <p className="text-xs text-slate-500 mt-1">
              Inspect typical pull request scenarios caught by PR Sentinel with before/after remediations.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Example 1: SQL Injection in Payment Microservice</span>
                <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold">CRITICAL</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                A developer added a dynamic query using f-strings inside <code>payments/checkout.py</code>. PR Sentinel blocked the merge and proposed parameterized query substitution.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Example 2: Accidental AWS Secret Leak in Terraform Script</span>
                <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold">CRITICAL</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                An engineer temporarily committed an AWS secret key to <code>infra/main.tf</code>. PR Sentinel redacted the secret in all comments and blocked branch merge before commit exposure.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. TAB 5: FAQ (FREQUENTLY ASKED QUESTIONS ACCORDION)                      */}
      {/* ========================================================================= */}
      {activeTab === "faq" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 animate-in fade-in duration-150">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Frequently Asked Questions</h3>
            <p className="text-xs text-slate-500 mt-1">
              Common questions about security, model training, GitHub App permissions, and merge policies.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            {[
              {
                q: "Does PR Sentinel train AI models on my private source code?",
                a: "No. PR Sentinel uses zero-data-retention enterprise API endpoints. Code diffs are analyzed strictly in-memory during evaluation and never used for model training or retained by third parties."
              },
              {
                q: "What permissions does the GitHub App require?",
                a: "The GitHub App requires repository read access (Contents: read), Pull Requests (read & write to post inline comments), and Checks (write to publish Check Runs). It does not require admin or write access to your repository code."
              },
              {
                q: "How are false positives handled?",
                a: "Authorized team leads or security engineers can suppress findings with a documented audit justification (marked as acceptable risk or false alarm). All suppressions are logged in the cryptographic Audit Ledger."
              },
              {
                q: "Can PR Sentinel block pull requests automatically?",
                a: "Yes. When you configure the PR Sentinel GitHub Check Run as a 'Required Status Check' in your repository branch protection settings, GitHub automatically prevents merging if PR Sentinel reports a policy failure."
              },
              {
                q: "How does PR Sentinel prevent prompt injection from malicious PRs?",
                a: "We wrap all untrusted code diffs, commit messages, and docstrings inside immutable XML delimiters with canary token validation. Output from the reviewer is verified against canary leaks before publication."
              }
            ].map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full text-left p-4 font-bold text-slate-800 bg-white hover:bg-slate-50 flex items-center justify-between transition"
                >
                  <span>{faq.q}</span>
                  {expandedFaq === idx ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {expandedFaq === idx && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-slate-600 text-[11px] leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: STEP-BY-STEP SETUP GUIDE (REQUESTED FIX: DOES NOT REDIRECT)     */}
      {/* ========================================================================= */}
      {showSetupGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">How to Setup PR Sentinel on GitHub</h3>
                  <p className="text-[11px] text-slate-500">Complete 5-step integration & branch protection guide</p>
                </div>
              </div>
              <button onClick={() => setShowSetupGuideModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">1</span>
                  <span>Create GitHub App in Organization Settings</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Go to <strong>GitHub Settings › Developer Settings › GitHub Apps › New GitHub App</strong>.
                  Set your Webhook URL to: <code>https://your-domain.com/api/v1/webhooks/github</code> and set a strong Webhook Secret.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center">2</span>
                  <span>Configure Required Permissions</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
                  <div>• <strong>Pull requests:</strong> Read & Write (to post inline annotations)</div>
                  <div>• <strong>Checks:</strong> Read & Write (to publish status checks)</div>
                  <div>• <strong>Repository contents:</strong> Read-only (to read diff files)</div>
                  <div>• <strong>Events subscribe:</strong> Check <em>Pull request</em></div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center">3</span>
                  <span>Configure Server Environment Variables</span>
                </div>
                <div className="bg-slate-900 text-emerald-300 font-mono p-2.5 rounded-lg text-[11px] space-y-0.5">
                  <div>GITHUB_APP_ID="123456"</div>
                  <div>GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."</div>
                  <div>GITHUB_WEBHOOK_SECRET="whsec_prod_your_secret_here"</div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">4</span>
                  <span>Enable Branch Protection in Your Repository</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Go to <strong>Repo Settings › Branches › Branch protection rules › Require status checks before merging</strong>.
                  Search for and require: <code>pr-sentinel/security-check</code>. This enforces that blocked PRs cannot be merged.
                </p>
              </div>

              {/* Step 5 */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1 text-emerald-950">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>5. Open a Test PR to Trigger First Review</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Open any pull request on your connected repository. PR Sentinel will immediately ingest the webhook, analyze the code diff, and post inline security annotations!
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setShowSetupGuideModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
              <Link
                to="/cicd"
                onClick={() => setShowSetupGuideModal(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
              >
                <span>Go to Repository Manager</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHAT WITH SENTINEL AI ASSISTANT                                 */}
      {/* ========================================================================= */}
      {showChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 text-xs flex flex-col h-[520px]">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Sentinel Assistant</h3>
                  <p className="text-[10px] text-slate-500">Online · AI Security Co-pilot</p>
                </div>
              </div>
              <button onClick={() => setShowChatModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto space-y-3 p-1">
              {chatHistory.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${m.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      m.sender === "user" ? "bg-slate-700 text-white" : "bg-indigo-600 text-white"
                    }`}
                  >
                    {m.sender === "user" ? "You" : "🤖"}
                  </div>
                  <div
                    className={`p-3 rounded-2xl text-xs max-w-[80%] leading-relaxed ${
                      m.sender === "user"
                        ? "bg-indigo-600 text-white rounded-tr-xs"
                        : "bg-slate-100 text-slate-800 rounded-tl-xs"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input Box */}
            <div className="pt-2 border-t flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask Sentinel anything about PR reviews, security checks, or setup..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
              />
              <button
                onClick={handleSendChat}
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-white hover:bg-indigo-700 transition"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
