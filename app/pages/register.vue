<template>
  <AuthForm mode="register" />
</template>

<script setup lang="ts">
/**
 * 注册页入口
 *
 * 说明：
 * - 仅在系统还没有账号时允许进入
 * - 使用独立 auth 布局
 * - 具体表单逻辑由 AuthForm 统一处理
 */
definePageMeta({
  layout: 'auth'
})

useHead({
  title: '注册 - MediaHub'
})
</script>
