<template>
  <AuthForm mode="login" />
</template>

<script setup lang="ts">
/**
 * 登录页入口
 *
 * 说明：
 * - 使用独立 auth 布局
 * - 具体表单逻辑由 AuthForm 统一处理
 */
definePageMeta({
  layout: 'auth'
})

useHead({
  title: '登录 - MediaHub'
})
</script>
