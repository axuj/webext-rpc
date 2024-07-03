<script setup lang="ts">
  import { ref } from 'vue'
  import { client } from '@/webext-rpc/client'
  function useTest(name: string, call: (value: Ref<any>) => void) {
    const value = ref()
    return {
      name,
      call: () => {
        call(value)
      },
      value,
    }
  }

  const tests = [
    useTest('normalFunction', async (value) => {
      value.value = await client.normalFunction(3, 'this is c')
    }),
    useTest('asyncFunction', async (value) => {
      value.value = await client.asyncFunction()
    }),
    useTest('generatorFunction', async (value) => {
      value.value = await client.generateGroup.generatorFunction()
    }),
    useTest('asyncGeneratorFunction', async (value) => {
      const iter = await client.generateGroup.asyncGeneratorFunction(4)
      if (value.value === undefined) {
        value.value = []
      }
      const result = ref({
        status: 'loading',
        time: new Date().toLocaleString(),
        data: [] as string[],
      })
      value.value.push(result)
      for await (const item of iter) {
        result.value.data.push(item)
      }
      result.value.status = 'done'
    }),
    useTest('fetchStream', async (value) => {
      const gemini_key = 'your_gemini_key_here'
      const iter = await client.fetchStream(
        gemini_key,
        'Write a 500-word fairy tale'
      )
      value.value = ''

      function extractBracesContent(input: string): string {
        const start = input.indexOf('{')
        const end = input.lastIndexOf('}')

        if (start === -1 || end === -1 || start >= end) {
          return '' // 没有找到有效的 {} 包含内容
        }
        return input.substring(start, end + 1)
      }

      for await (const item of iter) {
        const cleaned_text = extractBracesContent(item)
        try {
          if (!cleaned_text) {
            continue
          }
          const parser = JSON.parse(cleaned_text)
          const text = parser?.candidates?.[0]?.content?.parts?.[0]?.text
          if (!text) {
            continue
          }
          value.value += text
        } catch (e) {
          console.error('error parsing gemini response', e)
          console.error('raw response:', item)
          continue
        }
      }
    }),
  ]

  const show = ref(true)

  function closeWindow() {
    show.value = false
  }
</script>

<template>
  <div
    v-if="show"
    style="
      position: absolute;
      display: flex;
      justify-content: center;
      align-items: center;
      min-width: 400px;
      min-height: 200px;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: #f5f5f5;
      border-radius: 10px;
      z-index: 9999;
      padding: 20px;
    ">
    <button
      @click="closeWindow"
      style="position: absolute; top: 10px; right: 10px">
      close
    </button>
    <div>
      <h2>Test</h2>
      <ul>
        <li
          v-for="test in tests"
          :key="test.name">
          <button @click="test.call">
            {{ test.name }}
          </button>
          {{ test.value.value }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped></style>
