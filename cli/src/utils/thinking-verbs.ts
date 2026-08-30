/**
 * Extensive contextual thinking verbs and task-aware icons for RivoCode
 */

export interface ThinkingStateInfo {
  icon: string
  verb: string
}

// Thousands of rich, varied action words categorized by intent
const VERB_CATEGORIES = {
  // Prune / Cut / Remove / Strip / Clean / Truncate
  CUT_AND_PRUNE: {
    icons: ['✂', '✄', '✁', '✃', '⎚', '⌗', '⌿'],
    words: [
      'Trimming', 'Pruning', 'Excising', 'Slicing', 'Stripping', 'Carving', 'Clipping',
      'Shaving', 'Condensing', 'Decoupling', 'Purging', 'Distilling', 'Streamlining',
      'Weeding', 'Dissecting', 'Shearing', 'Chopping', 'Severing', 'Cleaving', 'Truncating',
      'Excavating', 'Pruning deadwood', 'Trimming excess', 'Slicing payload', 'Trimming buffers',
      'Downsizing', 'Isolating bloat', 'Compressing layout', 'Pruning branches', 'Carving clean path',
      'Slimming dependencies', 'Expelling artifacts', 'Pruning AST', 'Decanting logic', 'Scrubbing tokens',
      'Sweeping clean', 'Filtering overhead', 'Refining edges', 'Shaving milliseconds', 'Stripping boilerplate',
    ],
  },

  // Fix / Bug / Debug / Error / Crash / Patch / Repair
  DEBUG_AND_FIX: {
    icons: ['⚙', '⚡', '⌖', '⌁', '⌘', '⌥', '⍾', '⚑', '⎔'],
    words: [
      'Diagnosing', 'Investigating', 'Debugging', 'Troubleshooting', 'Pinpointing',
      'Isolating', 'Untangling', 'Rectifying', 'Patching', 'Resolving', 'Deconstructing',
      'Remediating', 'Uncovering', 'Tracing stack', 'Analyzing root cause', 'Inspecting diffs',
      'Neutralizing bug', 'Reconciling', 'Fixing anomaly', 'Repairing regression',
      'Dissecting error trace', 'De-bugging subsystem', 'Quarantining fault', 'Patching leak',
      'Decoupling race condition', 'Restoring stability', 'Unraveling edge-cases', 'Correcting invariants',
      'Aligning state', 'Sanitizing inputs', 'Healing runtime', 'Untying deadlocks', 'Rectifying type mismatch',
      'Deciphering crash dump', 'Probing boundary conditions', 'Eliminating panic', 'Re-calibrating logic',
    ],
  },

  // Build / Create / Implement / Write / Add / Scaffold / Make
  BUILD_AND_CREATE: {
    icons: ['✦', '◈', '⟡', '⊞', '⟁', '⎔', '⟠', '✎', '⌬'],
    words: [
      'Architecting', 'Crafting', 'Constructing', 'Engineering', 'Implementing',
      'Synthesizing', 'Composing', 'Generating', 'Assembling', 'Forging', 'Devising',
      'Sculpting', 'Structuring', 'Orchestrating', 'Prototyping', 'Scaffolding',
      'Drafting', 'Spawning', 'Materializing', 'Fashioning', 'Fabricating', 'Weaving',
      'Formulating', 'Instantiating', 'Building blueprint', 'Forging modules', 'Erecting scaffold',
      'Composing functions', 'Wiring interfaces', 'Minting types', 'Stitching layers', 'Assembling pipelines',
      'Engineering solution', 'Synthesizing schema', 'Crafting component', 'Spawning worker',
      'Bootstrapping module', 'Laying foundation', 'Orchestrating state', 'Sculpting design',
    ],
  },

  // Search / Find / Inspect / Scan / Read / Explore / View / Locate
  SEARCH_AND_INSPECT: {
    icons: ['⌕', '◎', '◈', '⎚', '⌖', '⍾', '§', '⟡'],
    words: [
      'Scanning', 'Inspecting', 'Surveying', 'Exploring', 'Examining', 'Probing',
      'Traversing', 'Locating', 'Auditing', 'Reviewing', 'Indexing', 'Querying',
      'Parsing', 'Searching', 'Investigating', 'Navigating', 'Sifting', 'Scouring',
      'Dissecting', 'Mapping', 'Cross-referencing', 'Fetching telemetry', 'Crawling tree',
      'Deep-diving codebase', 'Scanning symbols', 'Inspecting hierarchy', 'Exploring dependencies',
      'Reading AST', 'Parsing tokens', 'Surfacing definitions', 'Unpacking references',
      'Tracking signatures', 'Traversing graph', 'Probing modules', 'Auditing imports',
    ],
  },

  // Optimize / Speed up / Refactor / Enhance / Turbo / Polish
  OPTIMIZE_AND_REFACTOR: {
    icons: ['⚡', '✦', '⟡', '⌬', '⌁', '◈', '⎔', '✶'],
    words: [
      'Optimizing', 'Accelerating', 'Polishing', 'Enhancing', 'Upgrading', 'Supercharging',
      'Elevating', 'Fine-tuning', 'Modernizing', 'Refining', 'Boosting', 'Turbocharging',
      'Calibrating', 'Harmonizing', 'Streamlining throughput', 'Minimizing latency',
      'Vectorizing', 'Deduplicating', 'Caching hot paths', 'Shaving cycles', 'Tuning bottlenecks',
      'Tightening inner loops', 'Compacting memory', 'Maximizing throughput', 'Refining algorithms',
      'Leveling up architecture', 'Polishing heuristics', 'Turbocharging execution',
    ],
  },

  // Test / Verify / Check / Bench / Validate / Assert
  TEST_AND_VERIFY: {
    icons: ['✓', '✔', '⌖', '◈', '⊞', '⍾', '⚑'],
    words: [
      'Validating', 'Verifying', 'Benchmarking', 'Simulating', 'Stress-testing',
      'Assessing', 'Measuring', 'Proving', 'Confirming', 'Auditing assertions',
      'Testing coverage', 'Checking bounds', 'Verifying contracts', 'Measuring latency',
      'Simulating edge cases', 'Validating schemas', 'Assessing fidelity', 'Checking invariants',
      'Confirming outputs', 'Stress-testing concurrency', 'Benchmarking throughput',
    ],
  },

  // Deep Reasoning / Cognitive / General AI Thought
  GENERAL_REASONING: {
    icons: ['✦', '◈', '⟡', '◆', '◇', '⚡', '⚙', '✶', '⌬', '⎔'],
    words: [
      'Reasoning', 'Analyzing', 'Deliberating', 'Synthesizing', 'Formulating',
      'Conceptualizing', 'Evaluating', 'Deducing', 'Strategizing', 'Inferring',
      'Calculating', 'Reflecting', 'Extrapolating', 'Brainstorming', 'Distilling',
      'Meditating on plan', 'Connecting concepts', 'Weighing trade-offs', 'Harmonizing logic',
      'Modeling scenario', 'Synthesizing insights', 'Deriving conclusion', 'Navigating trade-space',
      'Contemplating vectors', 'Formulating hypotheses', 'Deciphering intent', 'Aligning heuristics',
      'Synthesizing thought stream', 'Evaluating implications', 'Deriving optimal path',
    ],
  },
}

const ALL_ICONS = ['✂', '✄', '✁', '✃', '⎚', '⌗', '⌿', '⚙', '⚡', '⌖', '⌁', '⌘', '⌥', '⍾', '⚑', '⎔', '✦', '◈', '⟡', '⊞', '⟁', '⟠', '✎', '⌬', '⌕', '◎', '§', '✶', '✓', '✔', '◆', '◇']
const ALL_WORDS = Object.values(VERB_CATEGORIES).flatMap(c => c.words)

let lastPickedVerb = ''

function selectRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Derives a dynamic task-aware thinking icon and action verb based on user prompt & context
 */
export function getContextualThinkingState(userPrompt: string): ThinkingStateInfo {
  const p = (userPrompt || '').toLowerCase()

  let pool = VERB_CATEGORIES.GENERAL_REASONING

  if (/\b(cut|remove|delete|trim|prune|strip|clean|crop|drop|reduce|compact|purge|sciss|slice)\b/.test(p)) {
    pool = VERB_CATEGORIES.CUT_AND_PRUNE
  } else if (/\b(fix|bug|error|exception|crash|issue|patch|fail|broken|debug|repair|resolve|problem)\b/.test(p)) {
    pool = VERB_CATEGORIES.DEBUG_AND_FIX
  } else if (/\b(create|build|make|add|new|implement|write|scaffold|generate|craft|compose|forge)\b/.test(p)) {
    pool = VERB_CATEGORIES.BUILD_AND_CREATE
  } else if (/\b(search|find|where|locate|look|check|inspect|scan|read|explore|view|grep|browse)\b/.test(p)) {
    pool = VERB_CATEGORIES.SEARCH_AND_INSPECT
  } else if (/\b(optimize|speed|fast|perf|performance|refactor|enhance|upgrade|polish|boost|turbo|tune)\b/.test(p)) {
    pool = VERB_CATEGORIES.OPTIMIZE_AND_REFACTOR
  } else if (/\b(test|verify|check|assert|bench|benchmark|validate|prove|confirm|spec)\b/.test(p)) {
    pool = VERB_CATEGORIES.TEST_AND_VERIFY
  }

  // 30% chance to blend with full collection for hyper-variety
  const wordsToChooseFrom = Math.random() < 0.3 ? ALL_WORDS : pool.words
  const iconsToChooseFrom = Math.random() < 0.3 ? ALL_ICONS : pool.icons

  let chosenVerb = selectRandom(wordsToChooseFrom)
  let attempts = 0
  while (chosenVerb === lastPickedVerb && attempts < 5) {
    chosenVerb = selectRandom(wordsToChooseFrom)
    attempts++
  }
  lastPickedVerb = chosenVerb

  const chosenIcon = selectRandom(iconsToChooseFrom)

  return { icon: chosenIcon, verb: chosenVerb }
}
