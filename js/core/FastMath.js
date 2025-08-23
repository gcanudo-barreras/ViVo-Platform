class FastMath {
    constructor() {
        this.caches = {
            exp: new Map(),
            log: new Map(),
            sqrt: new Map()
        };
        this.maxCacheSize = 1000;
    }

    _manageCache(cache, key, result) {
        if (cache.size >= this.maxCacheSize) {
            cache.delete(cache.keys().next().value);
        }
        cache.set(key, result);
        return result;
    }

    exp(x) {
        const cache = this.caches.exp;
        if (cache.has(x)) return cache.get(x);
        return this._manageCache(cache, x, Math.exp(x));
    }

    log(x) {
        if (x <= 0) return NaN;
        const cache = this.caches.log;
        if (cache.has(x)) return cache.get(x);
        return this._manageCache(cache, x, Math.log(x));
    }

    sqrt(x) {
        if (x < 0) return NaN;
        const cache = this.caches.sqrt;
        if (cache.has(x)) return cache.get(x);
        return this._manageCache(cache, x, Math.sqrt(x));
    }

    clearCaches() {
        Object.values(this.caches).forEach(cache => cache.clear());
    }
}

const fastMath = new FastMath();

if (typeof window !== 'undefined') {
    window.FastMath = FastMath;
    window.fastMath = fastMath;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FastMath, fastMath };
}