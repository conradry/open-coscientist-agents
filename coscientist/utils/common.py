import os
import re

from jinja2 import Environment, FileSystemLoader, select_autoescape

from coscientist.models.custom_types import ParsedHypothesis

_env = Environment(
    loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "..", "prompts")),
    autoescape=select_autoescape(),
    trim_blocks=True,
    lstrip_blocks=True,
)


def load_prompt(name: str, **kwargs) -> str:
    """
    Load a template from the prompts directory and renders
    it with the given kwargs.

    Parameters
    ----------
    name: str
        The name of the template to load, without the .md extension.
    **kwargs: dict
        The kwargs to render the template with.

    Returns
    -------
    str
        The rendered template.
    """
    return _env.get_template(f"{name}.md").render(**kwargs)


def parse_hypothesis_markdown(markdown_text: str) -> ParsedHypothesis:
    """
    Parse markdown text with # headings to extract Hypothesis, Reasoning, and Assumptions sections.

    Parameters
    ----------
    markdown_text : str
        Markdown text containing sections with # headings for Hypothesis, Reasoning, and Assumptions

    Returns
    -------
    ParsedHypothesis
        Structured output with hypothesis, reasoning, and assumptions fields extracted from markdown
    """
    if "#FINAL REPORT#" in markdown_text:
        markdown_text = markdown_text.split("#FINAL REPORT#")[1]

    # Split the text by # to get sections
    sections = markdown_text.split("#")

    # Initialize fields
    hypothesis = ""
    predictions = []
    assumptions = []

    # Process each section
    for section in sections:
        section = section.strip()
        if not section:
            continue

        # Split section into title and content
        lines = section.split("\n", 1)
        if len(lines) < 2:
            continue

        title = lines[0].strip().lower()
        content = lines[1].strip()

        # Match section titles (case-insensitive)
        if "hypothesis" in title:
            hypothesis = content
        elif "prediction" in title:
            predictions = _parse_numbered_list(content)
        elif "assumption" in title:
            assumptions = _parse_numbered_list(content)

    assert hypothesis, f"Hypothesis section is required: {markdown_text}"
    assert predictions, f"Predictions section is required: {markdown_text}"
    assert assumptions, f"Assumptions section is required: {markdown_text}"

    return ParsedHypothesis(
        hypothesis=hypothesis, predictions=predictions, assumptions=assumptions
    )


def _parse_numbered_list(content: str) -> list[str]:
    """
    Parse a numbered list from text content into a list of strings.

    Parameters
    ----------
    content : str
        Text containing a numbered list (e.g., "1. First item\n2. Second item")

    Returns
    -------
    list[str]
        List of individual items with numbering removed
    """
    if not content.strip():
        return []

    lines = content.split("\n")
    items = []

    # Regex to match various numbering formats: 1., 1), 1-, etc.
    number_pattern = re.compile(r"^\s*\d+[\.\)\-]\s*(.+)", re.MULTILINE)

    current_item = ""

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check if line starts with a number
        match = number_pattern.match(line)
        if match:
            # If we have a current item, add it to the list
            if current_item:
                items.append(current_item.strip())
            # Start new item
            current_item = match.group(1)
        else:
            # This line is a continuation of the current item
            if current_item:
                current_item += " " + line
            else:
                # Handle case where first line doesn't start with a number
                current_item = line

    # Add the last item
    if current_item:
        items.append(current_item.strip())

    return items
