import subprocess
import json
import os
from typing import List, Dict

def call_ollama_mistral(prompt: str) -> str:
    """Call local Ollama with Mistral model and return response."""
    try:
        result = subprocess.run(
            ['ollama', 'run', 'mistral'],
            input=prompt.encode('utf-8'),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60
        )
        return result.stdout.decode('utf-8').strip()
    except Exception as e:
        return f"[ERROR] {str(e)}"

def build_instruction(spec: Dict) -> str:
    """Construct the Mistral-friendly evaluation instruction, now with subject anchoring."""
    return f"""
You are a prompt refinement and evaluation expert.

Step 1 — Assign a content anchor:
Based on the prompt spec below, choose a specific, relevant subject (such as a topic, title, item, idea, or dataset) appropriate to the noun and goal. This content anchor should give the LLM something concrete to write about.

Step 2 — Render the natural-language prompt:
Rewrite the prompt clearly, incorporating:
- The action (verb)
- The subject (from Step 1)
- The tone (style)
- The length constraint
- The format
- The overall intent

Step 3 — Evaluate:
Rate how interpretable and executable the prompt is for a modern LLM.

📤 Return your answer as a JSON object with these keys:
- "subject": the specific subject you chose in Step 1
- "rendered_prompt": the full rewritten prompt
- "score": a float from 0.00 to 5.00
- "reason": 1–2 sentence rationale for the score

💡 Scoring Guide:
- 5.00 = Fully clear, specific, and model-executable
- 3.00 = Some ambiguity or missing context
- 0.00 = Too vague, confusing, or structurally broken

Respond with a **valid JSON object only**. No commentary, no Markdown.

Prompt spec:
{json.dumps(spec, indent=2)}
""".strip()


def evaluate_prompt_spec(spec: Dict) -> Dict:
    """Evaluate a single structured prompt spec and merge with result."""
    instruction = build_instruction(spec)
    response = call_ollama_mistral(instruction)

    try:
        parsed = json.loads(response)
        return {**spec, **parsed}
    except json.JSONDecodeError:
        return {
            **spec,
            "error": "Failed to parse Mistral response",
            "raw_response": response
        }

def load_jsonl(filepath: str) -> List[Dict]:
    """Load a .jsonl file into a list of dictionaries."""
    data = []
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        data.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    return data

def save_jsonl(data: List[Dict], filepath: str):
    """Save a list of dictionaries to a .jsonl file."""
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            for item in data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        print(f"✅ Saved {len(data)} evaluated prompts to {filepath}")
    except Exception as e:
        print(f"❌ Failed to save file: {str(e)}")

if __name__ == "__main__":
    input_path = "raw_prompts.jsonl"
    output_path = r"C:\admin\R&D\101_Python\autoprompte\prompts.jsonl"

    if not os.path.exists(input_path):
        print(f"❌ Input file not found: {input_path}")
        exit(1)

    enriched_prompts = []
    prompt_specs = load_jsonl(input_path)

    for i, spec in enumerate(prompt_specs):
        print(f"🔍 Evaluating prompt #{i+1}/{len(prompt_specs)}...")
        enriched = evaluate_prompt_spec(spec)
        enriched_prompts.append(enriched)
        print("📦 Saved prompt...")
        save_jsonl(enriched_prompts, output_path)

    if os.path.exists(output_path):
        print(f"📁 File confirmed at: {output_path}")
    else:
        print(f"❌ File not found after saving: {output_path}")