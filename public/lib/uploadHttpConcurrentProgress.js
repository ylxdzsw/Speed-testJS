;window.uploadHttpConcurrentProgress = class uploadHttpConcurrentProgress {
    constructor(urls, _1, _2, _3, testLength, _4, callbackComplete, callbackProgress, callbackError) {
        this.urls = urls
        this.size = 50000
        this.concurrentRuns = 4
        this.testLength = testLength
        this.monitorInterval = 200
        this._testIndex = 0
        this.completedRequests = 0
        this._activeTests = []
        this.clientCallbackComplete = callbackComplete
        this.clientCallbackProgress = callbackProgress
        this.clientCallbackError = callbackError
        this._beginTime = performance.now()
        this._running = false
        this.interval = null
        this.totalChunckBytes = 0
        this._payload = null
        this.resultsMb = []
        this.resultsIntervalMb = []
        this.intervalCounter = 0
    }

    onTestError() {
        this.completedRequests++
        if (this._running && (performance.now() - this._beginTime) < this.testLength)
            this.newRequests(1)
    }

    onTestComplete(result) {
        if (!this._running)
            return
        this.completedRequests++
        this.totalChunckBytes = this.totalChunckBytes + result
        
        const bandwidthMbs = ((this.totalChunckBytes * 8) / 1000000) / ((performance.now() - this._beginTime) / 1000)
        this.resultsMb.push(bandwidthMbs)
        this.resultsIntervalMb.push(bandwidthMbs)
        if(this.intervalCounter > 3){
            this.clientCallbackProgress(bandwidthMbs)
        }
        this.newRequests(1)
    }

    newRequests(number) {
        if (!this._running)
            return

        if (this._payload === null || this._payload.size !== this.size)
            this._payload = this.getRandomData(this.size)

        for (let p = 1; p <= number; p++) {
            this._testIndex++

            const controller = new AbortController()
            this._activeTests.push(controller)

            const size = this.size
            fetch(this.urls[0] + '?r=' + performance.now(), {
                method: 'POST',
                signal: controller.signal,
                body: this._payload,
            }).then(() => this.onTestComplete(size)).catch(() => this.onTestError())
        }
    }

    start() {
        return this.newRequests(this.concurrentRuns)
    }

    abortAll() {
        clearInterval(this.interval)
        for (const controller of this._activeTests)
            controller.abort()
    }

    endTest() {
        function meanCalculator(arr) {
            const peakValue = arr[arr.length - 1]
            const sum = arr.reduce((a, b) => a + b, 0)
            const mean = sum / arr.length
            return { mean, peakValue }
        }

        this._running = false
        this.abortAll()
        if (this.resultsMb.length > 10) {
            const dataLength = this.resultsMb.length
            const data = this.resultsMb
                .slice(Math.round(dataLength * 0.75), dataLength)
                .sort((a, b) => a - b)
            const result = meanCalculator(data)
            this.clientCallbackComplete(result)
        } else {
            this.clientCallbackError('no measurements obtained')
            return
        }
    }

    _monitor() {
        this.intervalCounter++
        if (this.resultsIntervalMb.length > 0) {
            const sum = this.resultsIntervalMb.reduce((a, b) => a + b)
            const avg = sum / this.resultsIntervalMb.length
            console.log('interval Bandwidth: ' + avg)
            this.resultsIntervalMb.length = 0
        }
        console.log(this.intervalCounter + '  ' + this.completedRequests + '  ' + this._testIndex + ' '  +this.intervalCounter*4)
        if(this.completedRequests>(this.intervalCounter*4)){
            this.size = this.size*1.1
            if (this.size > 10000000 || this.completedRequests > this.intervalCounter * 20)
                this.size = 10000000
        }
  
        if ((performance.now() - this._beginTime) > this.testLength) {
            clearInterval(this.interval)
            this.endTest()
        }
    }

    initiateTest() {
        this._testIndex = 0
        this._running = true
        this.interval = null
        this.totalChunckBytes = 0
        this._payload = null
        this.resultsMb.length = 0
        this.resultsIntervalMb.length = 0
        this.intervalCounter = 0
        this.completedRequests = 0
        this.interval = setInterval(() => this._monitor(), this.monitorInterval)
        this.start()
    }

    getRandomData(size) {
        function getData() {
            return Math.random().toString()
        }

        var count = size / 2
        var result = getData()

        while (result.length <= count) {
            result += getData()
        }

        result = result + result.substring(0, size - result.length)
        var blob
        try {
            blob = new Blob([result], { type: "text/plain" })
        } catch (e) {
            var bb = new BlobBuilder // jshint ignore:line
            bb.append(result)
            blob = bb.getBlob("text/plain")
        }
        console.log(blob.size)
        return blob
    }
}
