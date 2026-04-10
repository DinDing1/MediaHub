/**
 * 115云盘API请求队列管理器
 * 用于控制API请求频率，避免触发风控
 * 固定2秒间隔，配合缓存机制和批量操作减少实际API调用
 */

interface QueueItem<T> {
  execute: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
  description: string
}

const REQUEST_INTERVAL = 2000

class RequestQueue {
  private queue: QueueItem<any>[] = []
  private isProcessing: boolean = false
  private lastRequestTime: number = 0

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()
      if (!item) break
      
      const timeSinceLastRequest = Date.now() - this.lastRequestTime
      if (timeSinceLastRequest < REQUEST_INTERVAL) {
        await this.delay(REQUEST_INTERVAL - timeSinceLastRequest)
      }

      try {
        const result = await item.execute()
        this.lastRequestTime = Date.now()
        item.resolve(result)
      } catch (error: any) {
        this.lastRequestTime = Date.now()
        item.reject(error)
      }
    }

    this.isProcessing = false
  }

  async enqueue<T>(
    execute: () => Promise<T>,
    description: string = 'API请求'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem<T> = {
        execute,
        resolve,
        reject,
        description
      }

      this.queue.push(item)
      this.processQueue()
    })
  }

  getQueueLength(): number {
    return this.queue.length
  }

  clear(): void {
    this.queue.forEach(item => {
      item.reject(new Error('队列已清空'))
    })
    this.queue = []
  }
}

export const requestQueue = new RequestQueue()

export function enqueueRequest<T>(
  execute: () => Promise<T>,
  description?: string
): Promise<T> {
  return requestQueue.enqueue(execute, description)
}

export function getQueueLength(): number {
  return requestQueue.getQueueLength()
}

export function clearQueue(): void {
  requestQueue.clear()
}
