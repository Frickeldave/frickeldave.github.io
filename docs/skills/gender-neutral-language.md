# Gender-Neutral Language Skill

## Overview

This documentation explains the gender-neutral language skill and agent that have been added to the project to ensure inclusive language practices across all content.

## Skill Description

The gender-neutral language skill (`/.github/skills/gender-neutral-language/SKILL.md`) provides guidelines and best practices for writing gender-neutral German content. It covers various techniques for inclusive language and offers concrete alternatives to gendered terms.

## Agent Description

The gender-neutral language review agent (`/.github/agents/gender-neutral-language-review.agent.md`) is a specialized tool that can analyze content for gender-inclusive language practices and provide detailed feedback and suggestions for improvement.

## Usage

### Using the Skill

The skill is automatically available to GitHub Copilot when working on content files. It provides guidance on:

1. Techniques for gender-neutral German
2. Common gendered terms to avoid
3. Implementation guidelines
4. Review checklist

### Using the Agent

The agent can be invoked manually to review content for gender-neutral language practices. It will analyze content and provide:

1. Detailed analysis of problematic areas
2. Concrete improvement suggestions
3. Rating of inclusivity practices
4. Examples of improved text passages

## Integration with Existing Tools

This skill complements the existing Vale integration for language checking. While Vale focuses on automated rule-based checking, this skill provides more nuanced guidance for content creators.

## Best Practices

1. **Consistency**: Choose one method (star, gap, colon) and use it consistently throughout a document
2. **Readability**: Don't overuse gendering; it can reduce readability
3. **Context Matters**: Some contexts may require specific approaches
4. **Target Audience**: Consider your audience when choosing techniques

## Maintenance

To update the skill or agent:
1. Modify the respective files in `/.github/skills/gender-neutral-language/` or `/.github/agents/`
2. Test the changes by invoking the agent on sample content
3. Update this documentation if needed