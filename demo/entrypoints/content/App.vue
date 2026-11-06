<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import { client } from '@/webext-rpc/client'

  type Failure = {
    name: string
    message: string
    code?: string
  }

  type TestContext = {
    set: (value: unknown) => void
    append: (chunk: string) => void
    note: (text: string) => void
  }

  // A failed call rejects with an RpcError carrying a `code`. Read it
  // structurally instead of importing the class, so this demo also runs
  // against a build that predates it.
  function describeFailure(error: unknown): Failure {
    const candidate = error as {
      name?: unknown
      message?: unknown
      code?: unknown
    }

    return {
      name: typeof candidate?.name === 'string' ? candidate.name : 'Error',
      message:
        typeof candidate?.message === 'string'
          ? candidate.message
          : String(error),
      code: typeof candidate?.code === 'string' ? candidate.code : undefined,
    }
  }

  function useTest(name: string, call: (ctx: TestContext) => Promise<void>) {
    const output = ref<unknown>()
    const failure = ref<Failure>()
    const note = ref('')
    const running = ref(false)

    return {
      name,
      output,
      failure,
      note,
      running,
      async call() {
        if (running.value) return
        running.value = true
        output.value = undefined
        failure.value = undefined
        note.value = ''

        try {
          await call({
            set: (value) => {
              output.value = value
            },
            append: (chunk) => {
              output.value = `${output.value ?? ''}${chunk}`
            },
            note: (text) => {
              note.value = text
            },
          })
        } catch (error) {
          failure.value = describeFailure(error)
        } finally {
          running.value = false
        }
      },
    }
  }

  const tests = reactive([
    useTest('normalFunction', async ({ set }) => {
      set(await client.normalFunction(3, 'this is c'))
    }),
    useTest('asyncFunction', async ({ set }) => {
      set(await client.asyncFunction())
    }),
    useTest('generatorFunction', async ({ set }) => {
      set(await client.generateGroup.generatorFunction())
    }),
    useTest('asyncGeneratorFunction', async ({ set }) => {
      const iter = await client.generateGroup.asyncGeneratorFunction(4)
      const chunks: string[] = []
      set(chunks)
      for await (const item of iter) {
        chunks.push(item)
        set([...chunks])
      }
    }),
    useTest('fetchStream', async ({ set, append }) => {
      set('')
      const iter = await client.fetchStream('Write a 500-word fairy tale')
      for await (const item of iter) {
        append(item)
      }
    }),
    useTest('streamFailure', async ({ set, append, note }) => {
      // `fail` makes the mock endpoint drop the connection after a few chunks,
      // so this shows what a truncated stream looks like: the text that already
      // arrived stays on screen and the error is reported on top of it.
      set('')
      let chunks = 0
      try {
        const iter = await client.fetchStream('Watch this stream die', {
          fail: true,
        })
        for await (const item of iter) {
          chunks += 1
          append(item)
        }
      } finally {
        note(`received ${chunks} chunks`)
      }
    }),
  ])

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
      max-width: 620px;
      min-height: 200px;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: #f5f5f5;
      color: #333;
      border-radius: 10px;
      z-index: 9999;
      padding: 20px;
    ">
    <button
      @click="closeWindow"
      style="position: absolute; top: 10px; right: 10px">
      close
    </button>
    <div style="width: 100%">
      <h2>Test</h2>
      <ul class="list">
        <li
          v-for="test in tests"
          :key="test.name"
          class="row">
          <button
            :disabled="test.running"
            @click="test.call">
            {{ test.name }}
          </button>

          <span
            v-if="test.running"
            class="muted">
            running…
          </span>

          <div
            v-if="Array.isArray(test.output)"
            class="chunks">
            <div
              v-for="(chunk, index) in test.output"
              :key="index">
              {{ chunk }}
            </div>
          </div>
          <div
            v-else-if="test.output !== undefined"
            class="text">
            {{ test.output }}
          </div>

          <div
            v-if="test.note"
            class="muted">
            {{ test.note }}
          </div>

          <div
            v-if="test.failure"
            class="failure">
            <span v-if="test.failure.code">{{ test.failure.code }}: </span>
            {{ test.failure.name }}: {{ test.failure.message }}
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    margin-bottom: 10px;
  }

  .text {
    margin-top: 4px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .chunks {
    margin-top: 4px;
  }

  .muted {
    color: #666;
    font-size: 12px;
  }

  .failure {
    margin-top: 4px;
    color: #c0392b;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
