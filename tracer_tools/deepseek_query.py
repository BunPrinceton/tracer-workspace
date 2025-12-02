#!/usr/bin/env python3
"""Simple DeepSeek API wrapper since the CLI is broken."""
import os
import sys
from openai import OpenAI

def query_deepseek(prompt: str) -> str:
    client = OpenAI(
        api_key=os.environ.get("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com"
    )

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        stream=False
    )
    return response.choices[0].message.content

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python deepseek_query.py 'your prompt here'")
        sys.exit(1)

    prompt = " ".join(sys.argv[1:])
    print(query_deepseek(prompt))
