<script setup lang="ts">
  import { ref } from 'vue'
  import { erpc } from '@/webext-rpc/erpc'
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
      value.value = await erpc.a.b.normalFunction(3, 'this is c')
    }),
    useTest('asyncFunction', async (value) => {
      value.value = await erpc.af.asyncFunction()
    }),
    useTest('generatorFunction', async (value) => {
      value.value = await erpc.generatorFunction()
    }),
    useTest('asyncGeneratorFunction', async (value) => {
      const iter = await erpc.asyncGeneratorFunction(4)
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
