import random
import json
from typing import List, Dict

# === CONFIGURATION ===

def get_verbs() -> List[str]:
    return ["explain", "summarize", "generate", "extract", "plan"]

def get_nouns() -> Dict[str, Dict[str, str]]:
    return {
        "function": {"domain": "programming", "category": "education", "goal": "clarification"},
        "email": {"domain": "communication", "category": "business", "goal": "summarization"},
        "dataset": {"domain": "data", "category": "research", "goal": "planning"},
        "code": {"domain": "programming", "category": "technical", "goal": "generation"},
        "report": {"domain": "business", "category": "analysis", "goal": "summarization"},
        "itinerary": {"domain": "travel", "category": "logistics", "goal": "planning"},
        "prompt": {"domain": "AI", "category": "instruction", "goal": "generation"},
        "idea": {"domain": "creativity", "category": "brainstorming", "goal": "generation"},
        "plan": {"domain": "strategy", "category": "planning", "goal": "clarification"},
        "concept": {"domain": "education", "category": "learning", "goal": "explanation"}
    }

def get_styles() -> List[str]:
    return [
        "plain", "formal", "casual", "expert", 
        "narrative", "persuasive", "playful"
    ]

def get_formats() -> List[str]:
    return [
        "paragraph", "bullets", "steps", "table", "json",
        "qa", "outline", "checklist", "story", "anecdote", 
        "note", "memo"
    ]

def get_lengths() -> List[str]:
    return ["50w", "100w", "1s", "3b"]

def get_valid_formats_by_verb() -> Dict[str, List[str]]:
    return {
        "summarize": ["paragraph", "bullets", "qa", "note"],
        "generate": ["story", "json", "outline", "table"],
        "explain": ["paragraph", "qa", "memo", "note", "story"],
        "extract": ["json", "bullets", "checklist", "table"],
        "plan": ["steps", "checklist", "outline", "memo"]
    }

def get_valid_styles_by_format() -> Dict[str, List[str]]:
    return {
        "paragraph": ["plain", "formal", "expert", "narrative"],
        "bullets": ["plain", "casual", "expert"],
        "steps": ["plain", "casual", "expert"],
        "table": ["plain", "formal", "expert"],
        "json": ["plain", "expert"],
        "qa": ["plain", "expert", "formal"],
        "outline": ["plain", "expert"],
        "checklist": ["plain", "casual"],
        "story": ["narrative", "casual", "playful"],
        "anecdote": ["narrative", "playful"],
        "note": ["plain", "casual"],
        "memo": ["formal", "plain"]
    }

# === GENERATION FUNCTIONS ===

def choose_valid_format(verb: str, valid_map: Dict[str, List[str]], fallback: List[str]) -> str:
    return random.choice(valid_map.get(verb, fallback))

def choose_valid_style(format_: str, valid_map: Dict[str, List[str]], fallback: List[str]) -> str:
    return random.choice(valid_map.get(format_, fallback))

def choose_random_length(lengths: List[str]) -> str:
    return random.choice(lengths)

import random
from typing import List, Dict, Optional

def generate_prompt_spec(
    verbs: List[str],
    nouns: Dict[str, Dict[str, str]],
    styles: List[str],
    lengths: List[str],
    formats: List[str],
    valid_formats_by_verb: Dict[str, List[str]],
    valid_styles_by_format: Dict[str, List[str]],
    temperature_range: tuple = (0.2, 0.8),
    max_tokens_range: tuple = (100, 300),
    seed: Optional[int] = None,
    overrides: Optional[Dict] = None
) -> Dict:
    """
    Generates a single prompt spec, optionally seeded and overridden by caller.

    Args:
        verbs: list of verbs
        nouns: mapping of nouns to metadata
        styles: list of writing styles
        lengths: list of output length styles
        formats: list of valid formats
        valid_formats_by_verb: which formats each verb supports
        valid_styles_by_format: which styles fit each format
        temperature_range: (min, max) for float sampling
        max_tokens_range: (min, max) token limits
        seed: optional random seed for deterministic output
        overrides: optional manual overrides (e.g., {"verb": "explain"})

    Returns:
        A dict prompt spec
    """

    if seed is not None:
        random.seed(seed)

    # Apply overrides or fallback to random
    verb = overrides.get("verb") if overrides and "verb" in overrides else random.choice(verbs)
    noun = overrides.get("noun") if overrides and "noun" in overrides else random.choice(list(nouns.keys()))
    meta = nouns.get(noun, {"category": "general", "domain": "misc", "goal": "unspecified"})

    format_ = overrides.get("format") if overrides and "format" in overrides else \
        choose_valid_format(verb, valid_formats_by_verb, formats)

    style = overrides.get("style") if overrides and "style" in overrides else \
        choose_valid_style(format_, valid_styles_by_format, styles)

    length = overrides.get("length") if overrides and "length" in overrides else \
        choose_random_length(lengths)

    temperature = overrides.get("temperature") if overrides and "temperature" in overrides else \
        round(random.uniform(*temperature_range), 2)

    max_tokens = overrides.get("max_tokens") if overrides and "max_tokens" in overrides else \
        random.randint(*max_tokens_range)

    return {
        "verb": verb,
        "noun": noun,
        "style": style,
        "length": length,
        "format": format_,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "category": meta.get("category", "general"),
        "domain": meta.get("domain", "misc"),
        "goal": meta.get("goal", "unspecified")
    }


def generate_prompt_dataset(n: int = 10) -> List[Dict]:
    verbs = get_verbs()
    nouns = get_nouns()
    styles = get_styles()
    lengths = get_lengths()
    formats = get_formats()
    valid_formats_by_verb = get_valid_formats_by_verb()
    valid_styles_by_format = get_valid_styles_by_format()

    dataset = [
        generate_prompt_spec(
            verbs, nouns, styles, lengths, formats,
            valid_formats_by_verb, valid_styles_by_format
        ) for _ in range(n)
    ]
    return dataset

def save_prompts_to_jsonl(prompts: List[Dict], output_file: str = "rawprompts.jsonl") -> None:
    with open(output_file, "w", encoding="utf-8") as f:
        for prompt in prompts:
            f.write(json.dumps(prompt) + "\n")

# === ENTRY POINT ===

if __name__ == "__main__":
    dataset = generate_prompt_dataset(n=10000)
    save_prompts_to_jsonl(dataset, "raw_prompts.jsonl")
    print(f"✅ Generated {len(dataset)} prompts → raw_prompts.jsonl")

# This script generates a dataset of prompts based on various configurations and saves them in JSONL format.
# It includes verbs, nouns with metadata, styles, formats, and lengths.