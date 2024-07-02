export class ExposedPromise<T = any> {
  public resolve!: (value: T | PromiseLike<T>) => void
  public reject!: (reason?: any) => void

  public promise: Promise<T>
  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }
}
