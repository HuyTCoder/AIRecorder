import time
import asyncio
from google import genai

async def run_test():
    print("Testing fake key with Gemini...")
    start = time.time()
    try:
        client = genai.Client(api_key="fake_key_12345")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents="Hello",
        )
        print("Success:", response.text)
    except Exception as e:
        print("Error:", e)
    finally:
        print(f"Time taken: {time.time() - start:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(run_test())
