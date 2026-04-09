class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`[CIRCUIT_BREAKER] ${this.name}: OPEN → HALF_OPEN (testing)`);
      } else {
        throw new Error(`Circuit breaker OPEN for ${this.name}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      console.log(`[CIRCUIT_BREAKER] ${this.name}: HALF_OPEN → CLOSED (recovered)`);
    }
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      console.log(`[CIRCUIT_BREAKER] ${this.name}: HALF_OPEN → OPEN (still failing)`);
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log(`[CIRCUIT_BREAKER] ${this.name}: CLOSED → OPEN (${this.failures} failures)`);
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Singleton instance for org-service calls
export const orgServiceBreaker = new CircuitBreaker('org-service', {
  failureThreshold: 5,
  resetTimeout: 30000,
});

export default CircuitBreaker;
