/**
 * MakeCode editor extension for single or multiple MAX7219 8x8 matrix LED modules
 * by Alan Wang
 */
//% weight=100 color=#006d19 icon="\uf00a" block="MAX7219 8x8"
namespace MAX7219_Matrix {

    //Registers (command) for MAX7219
    const _NOOP: number = 0 // no-op (do nothing, doesn't change current status)
    const _DIGIT: number[] = [1, 2, 3, 4, 5, 6, 7, 8] // digit (LED column)
    const _DECODEMODE: number = 9 // decode mode (1=on, 0-off; for 7-segment display on MAX7219, no usage here)
    const _INTENSITY: number = 10 // intensity (LED brightness level, 0-15)
    const _SCANLIMIT: number = 11 // scan limit (number of scanned digits)
    const _SHUTDOWN: number = 12 // turn on (1) or off (0)
    const _DISPLAYTEST: number = 15 // force all LEDs light up, no usage here

    let _pinCS: DigitalPin = DigitalPin.P16 // LOAD pin, 0=ready to receive command, 1=command take effect
    let _matrixNum: number = 1 // number of MAX7219 matrix linked in the chain
    let _displayArray: number[] = [] // display array to show accross all matrixs
    let _isRotate: boolean = false // rotate display clockwise (for head-to-head linked modules)

    /**
    * Setup/reset MAX7219s.
    * If you are using 4-in-1 module you'll need to set rotation as true.
    * If your chain are consisted of single modules set it as false (default).
    */
    //% block="Setup MAX7219:|Number of matrixs $num|CS(LOAD) = $cs|MOSI(DIN) = $mosi|MISO(not used) = $miso|SCK(CLK) = $sck|Rotate for 4-in-1 module $rotate"
    //% num.min=1 num.defl=1
    //% cs.defl=DigitalPin.P16
    //% mosi.defl=DigitalPin.P15
    //% miso.defl=DigitalPin.P14
    //% sck.defl=DigitalPin.P13
    //% rotate.defl=false
    //% group="1. Setup"
    export function setup(num: number, cs: DigitalPin, mosi: DigitalPin, miso: DigitalPin, sck: DigitalPin, rotate: boolean) {
        // set internal variables        
        _pinCS = cs
        _matrixNum = num
        _isRotate = rotate
        // prepare display array (for displaying texts; add extra 8 columns at each side as buffers)
        for (let i = 0; i < (num + 2) * 8; i++) {
            _displayArray.push(0)
        }
        // set micro:bit SPI
        pins.spiPins(mosi, miso, sck)
        pins.spiFormat(8, 3)
        pins.spiFrequency(1000000)
        // initialize MAX7219s
        _registerAll(_SHUTDOWN, 0) // turn off
        _registerAll(_DISPLAYTEST, 0) // test mode off
        _registerAll(_DECODEMODE, 0) // decode mode off
        _registerAll(_SCANLIMIT, 7) // set scan limit to 7 (column 0-7)
        _registerAll(_INTENSITY, 15) // set brightness to 15
        _registerAll(_SHUTDOWN, 1) // turn on
        clearAll() // clear screen on all MAX7219s
    }

    /**
    * (internal function) write command and data to all MAX7219s
    */
    function _registerAll(addressCode: number, data: number) {
        pins.digitalWritePin(_pinCS, 0) // LOAD=LOW, start to receive commands
        for (let i = 0; i < _matrixNum; i++) {
            // when a MAX7219 received a new command/data set
            // the previous one would be pushed to the next matrix along the chain via DOUT
            pins.spiWrite(addressCode) // command (8 bits)
            pins.spiWrite(data) //data (8 bits)
        }
        pins.digitalWritePin(_pinCS, 1) // LOAD=HIGH, commands take effect
    }

    /**
    * (internal function) write command and data to a specific MAX7219 (index 0=farthest on the chain)
    */
    function _registerForOne(addressCode: number, data: number, matrixIndex: number) {
        if (matrixIndex <= _matrixNum - 1) {
            pins.digitalWritePin(_pinCS, 0) // LOAD=LOW, start to receive commands
            for (let i = 0; i < _matrixNum; i++) {
                // when a MAX7219 received a new command/data set
                // the previous one would be pushed to the next matrix along the chain via DOUT
                if (i == matrixIndex) { // send change to target
                    pins.spiWrite(addressCode) // command (8 bits)
                    pins.spiWrite(data) //data (8 bits)
                } else { // do nothing to non-targets
                    pins.spiWrite(_NOOP)
                    pins.spiWrite(0)
                }
            }
            pins.digitalWritePin(_pinCS, 1) // LOAD=HIGH, commands take effect
        }
    }

    /**
    * (internal function) rotate matrix clockwise
    */
    function _rotateMatrix(matrix: number[][]): number[][] {
        let tmp: number = 0
        for (let i = 0; i < 4; i++) {
            for (let j = i; j < 7 - i; j++) {
                tmp = matrix[i][j];
                matrix[i][j] = matrix[j][7 - i]
                matrix[j][7 - i] = matrix[7 - i][7 - j]
                matrix[7 - i][7 - j] = matrix[7 - j][i]
                matrix[7 - j][i] = tmp
            }
        }
        return matrix
    }

    /**
    * (internal function) get 8x8 matrix from a column array
    */
    function _getMatrixFromColumns(columns: number[]): number[][] {
        let matrix: number[][] = getEmptyMatrix()
        let binaryStr: string = ""
        for (let i = 0; i < 8; i++) {
            for (let j = 7; j >= 0; j--) {
                if (columns[i] >= 2 ** j) {
                    columns[i] -= 2 ** j
                    matrix[i][j] = 1
                } else if (columns[i] == 0) {
                    break
                }
            }
        }
        return matrix
    }

    /**
    * Scroll a text accross all MAX7219 matrixs for once
    */
    //% block="Scroll text $text|delay (ms) $delay|at the end wait (ms) $endDelay"
    //% text.defl="Hello world!"
    //% delay.min=0 delay.defl=75
    //% endDelay.min=0 endDelay.defl=500
    //% blockExternalInputs=true
    //% group="2. Display text on matrixs"
    export function scrollText(text: string, delay: number, endDelay: number) {
        let printPosition: number = _displayArray.length - 8
        let characters_index: number[] = []
        let currentChrIndex: number = 0
        let currentFontArray: number[] = []
        let nextChrCountdown: number = 1
        let chrCountdown: number[] = []
        let totalScrollTime = 0
        // clear screen and array
        for (let i = 0; i < _displayArray.length; i++) {
            _displayArray[i] = 0
        }
        clearAll()
        // get font index of every characters and total scroll time needed
        for (let i = 0; i < text.length; i++) {
            let index: number = font.indexOf(text.substr(i, 1))
            if (index >= 0) {
                characters_index.push(index)
                chrCountdown.push(font_matrix[index].length)
                totalScrollTime += font_matrix[index].length
            }
        }
        totalScrollTime += _matrixNum * 8
        // print characters into array and scroll the array
        for (let i = 0; i < totalScrollTime; i++) {
            nextChrCountdown -= 1
            if (currentChrIndex < characters_index.length && nextChrCountdown == 0) {
                // print a character just "outside" visible area
                currentFontArray = font_matrix[characters_index[currentChrIndex]]
                if (currentFontArray != null) {
                    for (let j = 0; j < currentFontArray.length; j++) {
                        _displayArray[printPosition + j] = currentFontArray[j]
                    }
                }
                // wait until current character scrolled into visible area
                nextChrCountdown = chrCountdown[currentChrIndex]
                currentChrIndex += 1
            }
            // scroll array (copy all columns to the one before it)
            for (let j = 0; j < _displayArray.length - 1; j++) {
                _displayArray[j] = _displayArray[j + 1]
            }
            _displayArray[_displayArray.length - 1] = 0
            // write every 8 columns of display array (visible area) to each MAX7219s
            let matrixCountdown: number = _matrixNum - 1
            for (let j = 8; j < _displayArray.length - 8; j += 8) {
                if (matrixCountdown < 0) break
                if (!_isRotate) {
                    for (let k = j; k < j + 8; k++) {
                        _registerForOne(_DIGIT[k - j], _displayArray[k], matrixCountdown)
                    }
                } else { // rotate matrix if needed
                    let tmpColumns: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
                    let l: number = 0
                    for (let k = j; k < j + 8; k++) {
                        tmpColumns[l++] = _displayArray[k]
                    }
                    displayLEDsForOne(_getMatrixFromColumns(tmpColumns), _matrixNum - 1 - matrixCountdown)
                }
                matrixCountdown -= 1
            }
            basic.pause(delay)
        }
        basic.pause(endDelay)
    }

    /**
    * Print a text accross the chain of MAX7219 matrixs at a specific spot. 
    * Offset value -8 ~ last column of matrixs. 
    * You can choose to clear the screen or not (if not it can be used to print multiple string on the MAX7219 chain).
    */
    //% block="Display text $text|offset $offset|clear screen first $clear"
    //% text.defl="Hi!"
    //% offset.min=-8
    //% clear.defl=true
    //% blockExternalInputs=true
    //% group="2. Display text on matrixs"
    export function displayText(text: string, offset: number, clear: boolean) {
        // clear screen and array if needed
        if (clear) {
            for (let i = 0; i < _displayArray.length; i++) {
                _displayArray[i] = 0
            }
            clearAll()
        }
        let printPosition: number = Math.constrain(offset, -8, _displayArray.length - 9) + 8
        let currentPosition: number = printPosition
        let characters_index: number[] = []
        let currentChrIndex: number = 0
        let currentFontArray: number[] = []
        // get font index of every characters
        for (let i = 0; i < text.length; i++) {
            let index = font.indexOf(text.substr(i, 1))
            if (index >= 0) {
                characters_index.push(index)
            }
        }
        // print characters into array from offset position
        while (currentPosition < _displayArray.length - 8) {
            currentFontArray = font_matrix[characters_index[currentChrIndex]]
            if (currentFontArray != null) {
                for (let j = 0; j < currentFontArray.length; j++) {
                    _displayArray[printPosition++] = currentFontArray[j]
                }
            }
            currentChrIndex += 1
            if (currentChrIndex == characters_index.length) break
        }
        // write every 8 columns of display array (visible area) to each MAX7219s
        let matrixCountdown: number = _matrixNum - 1
        for (let i = 8; i < _displayArray.length - 8; i += 8) {
            if (matrixCountdown < 0) break
            if (!_isRotate) {
                for (let j = i; j < i + 8; j++) {
                    _registerForOne(_DIGIT[j - i], _displayArray[j], matrixCountdown)
                }
            } else { // rotate matrix and reverse order if needed
                let tmpColumns: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
                let l: number = 0
                for (let j = i; j < i + 8; j++) {
                    tmpColumns[l++] = _displayArray[j]
                }
                displayLEDsForOne(_getMatrixFromColumns(tmpColumns), _matrixNum - 1 - matrixCountdown)
            }
            matrixCountdown -= 1
        }
    }

    /**
    * Print a custom character from a number array on the chain of MAX7219 matrixs at a specific spot. 
    * Each number in the array is 0-255, the decimal version of column's byte number.
    * Offset value -8 ~ last column of matrixs. 
    * You can choose to clear the screen or not (if not it can be used to print multiple string on the MAX7219 chain).
    */
    //% block="Display custom character from|number array $customCharArray|offset $offset|clear screen first $clear"
    //% offset.min=-8
    //% clear.defl=true
    //% blockExternalInputs=true
    //% group="2. Display text on matrixs"
    //% advanced=true
    export function displayCustomCharacter(customCharArray: number[], offset: number, clear: boolean) {
        // clear screen and array if needed
        if (clear) {
            for (let i = 0; i < _displayArray.length; i++) {
                _displayArray[i] = 0
            }
            clearAll()
        }
        let printPosition: number = Math.constrain(offset, -8, _displayArray.length - 9) + 8
        if (customCharArray != null) {
            // print column data to display array
            for (let i = 0; i < customCharArray.length; i++) {
                _displayArray[printPosition + i] = customCharArray[i]
            }
            // write every 8 columns of display array (visible area) to each MAX7219s
            let matrixCountdown = _matrixNum - 1
            for (let i = 8; i < _displayArray.length - 8; i += 8) {
                if (matrixCountdown < 0) break
                if (!_isRotate) {
                    for (let j = i; j < i + 8; j++) {
                        _registerForOne(_DIGIT[j - i], _displayArray[j], matrixCountdown)
                    }
                } else { // rotate matrix and reverse order if needed
                    let tmpColumns: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
                    let l: number = 0
                    for (let j = i; j < i + 8; j++) {
                        tmpColumns[l++] = _displayArray[j]
                    }
                    displayLEDsForOne(_getMatrixFromColumns(tmpColumns), _matrixNum - 1 - matrixCountdown)
                }
                matrixCountdown -= 1
            }
        }
    }

    /**
    * Return a number array calculated from a 8x8 LED byte array 
    * (example: B00100000,B01000000,B10000110,B10000000,B10000000,B10000110,B01000000,B00100000)
    */
    //% block="Get custom character number array|from byte-array string $text"
    //% text.defl="B00100000,B01000000,B10000110,B10000000,B10000000,B10000110,B01000000,B00100000"
    //% blockExternalInputs=true
    //% group="2. Display text on matrixs"
    //% advanced=true
    export function getCustomCharacterArray(text: string) {
        let tempTextArray: string[] = []
        let resultNumberArray: number[] = []
        let currentIndex: number = 0
        let currentChr: string = ""
        let currentNum: number = 0
        let columnNum: number = 0
        if (text != null && text.length >= 0) {
            // seperate each byte number to a string
            while (currentIndex < text.length) {
                tempTextArray.push(text.substr(currentIndex + 1, 8))
                currentIndex += 10
            }
            for (let i = 0; i < tempTextArray.length; i++) {
                columnNum = 0
                // read each bit and calculate the decimal sum
                for (let j = tempTextArray[i].length - 1; j >= 0; j--) {
                    currentChr = tempTextArray[i].substr(j, 1)
                    if (currentChr == "1" || currentChr == "0") {
                        currentNum = parseInt(currentChr)
                    } else {
                        currentNum = 0
                    }
                    columnNum += (2 ** (tempTextArray[i].length - j - 1)) * currentNum
                }
                // generate new decimal array
                resultNumberArray.push(columnNum)
            }
            return resultNumberArray
        } else {
            return null
        }
    }

    /**
    * Add a custom character from a number array at the end of the extension's font library.
    * Each number in the array is 0-255, the decimal version of column's byte number.
    */
    //% block="Add custom character $chr|number array $customCharArray|to the extension font library"
    //% chr.defl=""
    //% blockExternalInputs=true
    //% group="2. Display text on matrixs"
    //% advanced=true
    export function addCustomChr(chr: string, customCharArray: number[]) {
        if (chr != null && chr.length == 1 && customCharArray != null) {
            // add new character
            font.push(chr)
            font_matrix.push(customCharArray)
        }
    }

    /**
    * Display all fonts in the extension font library
    */
    //% block="Display all fonts at delay $delay"
    //% delay.min=0 delay.defl=200
    //% group="2. Display text on matrixs"
    //% advanced=true
    export function fontDemo(delay: number) {
        let offsetIndex: number = 0
        clearAll()
        // print all characters on all matrixs
        for (let i = 1; i < font_matrix.length; i++) {
            // print two blank spaces to "reset" a matrix
            displayCustomCharacter(font_matrix[0], offsetIndex * 8, false)
            displayCustomCharacter(font_matrix[0], offsetIndex * 8 + 4, false)
            // print a character
            displayCustomCharacter(font_matrix[i], offsetIndex * 8, false)
            if (offsetIndex == _matrixNum - 1) {
                offsetIndex = 0
            } else {
                offsetIndex += 1
            }
            basic.pause(delay)
        }
        basic.pause(delay)
        clearAll()
    }

    /**
    * Turn on or off all MAX7219s
    */
    //% block="Turn on all matrixs $status"
    //% status.defl=true
    //% group="3. Basic light control"
    //% advanced=true
    export function togglePower(status: boolean) {
        if (status) {
            _registerAll(_SHUTDOWN, 1)
        } else {
            _registerAll(_SHUTDOWN, 0)
        }
    }

    /**
    * Set brightness level of LEDs on all MAX7219s
    */
    //% block="Set all brightness level $level"
    //% level.min=0 level.max=15 level.defl=15
    //% group="3. Basic light control"
    export function brightnessAll(level: number) {
        _registerAll(_INTENSITY, level)
    }

    /**
    * Set brightness level of LEDs on a specific MAX7219s (index 0=farthest on the chain)
    */
    //% block="Set brightness level $level on matrix index = $index"
    //% level.min=0 level.max=15 level.defl=15
    //% index.min=0
    //% group="3. Basic light control"
    //% advanced=true
    export function brightnessForOne(level: number, index: number) {
        _registerForOne(_INTENSITY, level, index)
    }

    /**
    * Turn on all LEDs on all MAX7219s
    */
    //% block="Fill all LEDs"
    //% group="3. Basic light control"
    export function fillAll() {
        for (let i = 0; i < 8; i++) {
            _registerAll(_DIGIT[i], 255)
        }
    }

    /**
    * Turn on LEDs on a specific MAX7219
    */
    //% block="Fill LEDs on matrix index = $index"
    //% index.min=0
    //% group="3. Basic light control"
    //% advanced=true
    export function fillForOne(index: number) {
        for (let i = 0; i < 8; i++) {
            _registerForOne(_DIGIT[i], 255, index)
        }
    }

    /**
    * Turn off LEDs on all MAX7219s
    */
    //% block="Clear all LEDs"
    //% group="3. Basic light control"
    export function clearAll() {
        for (let i = 0; i < 8; i++) {
            _registerAll(_DIGIT[i], 0)
        }
    }

    /**
    * Turn off LEDs on a specific MAX7219 (index 0=farthest on the chain)
    */
    //% block="Clear LEDs on matrix index = $index"
    //% index.min=0
    //% group="3. Basic light control"
    //% advanced=true
    export function clearForOne(index: number) {
        for (let i = 0; i < 8; i++) {
            _registerForOne(_DIGIT[i], 0, index)
        }
    }

    /**
    * Turn on LEDs randomly on all MAX7219s
    */
    //% block="Randomize all LEDs"
    //% index.min=0
    //% group="3. Basic light control"
    export function randomizeAll() {
        for (let i = 0; i < 8; i++) {
            _registerAll(_DIGIT[i], Math.randomRange(0, 255))
        }
    }

    /**
    * Turn on LEDs randomly on a specific MAX7219 (index 0=farthest on the chain)
    */
    //% block="Randomize LEDs on matrix index = $index"
    //% index.min=0
    //% group="3. Basic light control"
    //% advanced=true
    export function randomizeForOne(index: number) {
        for (let i = 0; i < 8; i++) {
            _registerForOne(_DIGIT[i], Math.randomRange(0, 255), index)
        }
    }

    /**
    * Set LEDs of all MAX7219s to a pattern from a 8x8 matrix variable (index 0=farthest on the chain)
    */
    //% block="Display 8x8 pattern $newMatrix on all matrixs "
    //% group="4. Set custom LED pattern on matrixs"
    //% advanced=true
    export function displayLEDsToAll(newMatrix: number[][]) {
        let columnValue: number = 0
        if (newMatrix != null) {
            if (_isRotate) newMatrix = _rotateMatrix(newMatrix) // rotate matrix if needed
            for (let i = 0; i < 8; i++) {
                if (newMatrix[i] != null) {
                    columnValue = 0
                    for (let j = 0; j < 8; j++) {
                        if (newMatrix[i][j]) {
                            // combine row 0-7 status into a byte number (0-255)
                            columnValue += 2 ** j
                        }
                    }
                    _registerAll(_DIGIT[i], columnValue)
                }
            }
        }
    }

    /**
    * Set LEDs of a specific MAX7219s to a pattern from a 8x8 number matrix variable (index 0=farthest on the chain)
    */
    //% block="Display 8x8 pattern $newMatrix|on matrix index = $index"
    //% index.min=0
    //% blockExternalInputs=true
    //% group="4. Set custom LED pattern on matrixs"
    export function displayLEDsForOne(newMatrix: number[][], index: number) {
        let columnValue: number = 0
        if (newMatrix != null) {
            if (_isRotate) newMatrix = _rotateMatrix(newMatrix) // rotate matrix if needed
            for (let i = 0; i < 8; i++) {
                if (newMatrix[i] != null) {
                    columnValue = 0
                    for (let j = 0; j < 8; j++) {
                        if (newMatrix[i][j]) {
                            // combine row 0-7 status into a byte number (0-255)
                            columnValue += 2 ** j
                        }
                    }
                    _registerForOne(_DIGIT[i], columnValue, index)
                }
            }
        }
    }

    // various matrix/array data functions;
    // users can store matrix status themselves, change it and write into MAX7219

    /**
    * Return a empty 8x8 number matrix variable
    */
    //% block="Empty 8x8 pattern"
    //% group="4. Set custom LED pattern on matrixs"
    export function getEmptyMatrix() {
        return [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ]
    }

    /**
    * Return a full 8x8 number matrix variable
    */
    //% block="Full 8x8 pattern"
    //% group="4. Set custom LED pattern on matrixs"
    //% advanced=true
    export function getFullMatrix() {
        return [
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
        ]
    }

    /**
    * Return a specific value from a 8x8 number matrix variable
    */
    //% block="Get value from 8x8 pattern %matrix|x = $x y = $y"
    //% x.min=0 x.max=7
    //% y.min=0 y.max=7
    //% group="4. Set custom LED pattern on matrixs"
    //% blockExternalInputs=true
    //% advanced=true
    export function getValueFromMatrix(matrix: number[][], x: number, y: number) {
        return matrix[x][y]
    }

    /**
    * Set a specific value in a 8x8 number matrix variable
    */
    //% block="Set 8x8 pattern %matrix|x = $x y = $y value to $value"
    //% value.min=0 value.max=1
    //% x.min=0 x.max=7
    //% y.min=0 y.max=7
    //% blockExternalInputs=true
    //% group="4. Set custom LED pattern on matrixs"
    export function setValueInMatrix(matrix: number[][], x: number, y: number, value: number) {
        matrix[x][y] = value
    }

    /**
    * Toggle (between 0/1) a specific value in a 8x8 number matrix variable
    */
    //% block="Toogle value in 8x8 pattern %matrix|x = $x y = $y"
    //% x.min=0 x.max=7
    //% y.min=0 y.max=7
    //% blockExternalInputs=true
    //% group="4. Set custom LED pattern on matrixs"
    //% advanced=true
    export function toogleValueInMatrix(matrix: number[][], x: number, y: number) {
        if (matrix[x][y] == 1) {
            matrix[x][y] = 0
        } else if (matrix[x][y] == 0) {
            matrix[x][y] = 1
        }
    }

    // ASCII fonts borrowed from https://github.com/lyle/matrix-led-font/blob/master/src/index.js

    let font = [" ", "!", "\"", "#", "$", "%", "&", "\'", "(", ")",
        "*", "+", ",", "-", ".", "/",
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
        ":", ";", "<", "=", ">", "?", "@",
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
        "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
        "[", "\\", "]", "_", "`",
        "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l",
        "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
        "{", "|", "}", "~", "^"]

    let font_matrix = [
        [0b00000000,
            0b00000000,
            0b00000000,
            0b00000000],
        [0b01011111,
            0b00000000],
        [0b00000011,
            0b00000000,
            0b00000011,
            0b00000000],
        [0b00010100,
            0b00111110,
            0b00010100,
            0b00111110,
            0b00010100,
            0b00000000],
        [0b00100100,
            0b01101010,
            0b00101011,
            0b00010010,
            0b00000000],
        [0b01100011,
            0b00010011,
            0b00001000,
            0b01100100,
            0b01100011,
            0b00000000],
        [0b00110110,
            0b01001001,
            0b01010110,
            0b00100000,
            0b01010000,
            0b00000000],
        [0b00000011,
            0b00000000],
        [0b00011100,
            0b00100010,
            0b01000001,
            0b00000000],
        [0b01000001,
            0b00100010,
            0b00011100,
            0b00000000],
        [0b00101000,
            0b00011000,
            0b00001110,
            0b00011000,
            0b00101000,
            0b00000000],
        [0b00001000,
            0b00001000,
            0b00111110,
            0b00001000,
            0b00001000,
            0b00000000],
        [0b10110000,
            0b01110000,
            0b00000000],
        [0b00001000,
            0b00001000,
            0b00001000],
        [0b01100000,
            0b01100000,
            0b00000000],
        [0b01100000,
            0b00011000,
            0b00000110,
            0b00000001,
            0b00000000],
        [0b00111110,
            0b01000001,
            0b01000001,
            0b00111110,
            0b00000000],
        [0b01000010,
            0b01111111,
            0b01000000,
            0b00000000],
        [0b01100010,
            0b01010001,
            0b01001001,
            0b01000110,
            0b00000000],
        [0b00100010,
            0b01000001,
            0b01001001,
            0b00110110,
            0b00000000],
        [0b00011000,
            0b00010100,
            0b00010010,
            0b01111111,
            0b00000000],
        [0b00100111,
            0b01000101,
            0b01000101,
            0b00111001,
            0b00000000],
        [0b00111110,
            0b01001001,
            0b01001001,
            0b00110000,
            0b00000000],
        [0b01100001,
            0b00010001,
            0b00001001,
            0b00000111,
            0b00000000],
        [0b00110110,
            0b01001001,
            0b01001001,
            0b00110110,
            0b00000000],
        [0b00000110,
            0b01001001,
            0b01001001,
            0b00111110,
            0b00000000],
        [0b00010100,
            0b00000000],
        [0b00100000,
            0b00010100,
            0b00000000],
        [0b00001000,
            0b00010100,
            0b00100010,
            0b00000000],
        [0b00010100,
            0b00010100,
            0b00010100,
            0b00000000],
        [0b00100010,
            0b00010100,
            0b00001000,
            0b00000000],
        [0b00000010,
            0b01011001,
            0b00001001,
            0b00000110,
            0b00000000],
        [0b00111110,
            0b01001001,
            0b01010101,
            0b01011101,
            0b00001110,
            0b00000000],
        [0b01111110,
            0b00010001,
            0b00010001,
            0b01111110,
            0b00000000],
        [0b01111111,
            0b01001001,
            0b01001001,
            0b00110110,
            0b00000000],
        [0b00111110,
            0b01000001,
            0b01000001,
            0b00100010,
            0b00000000],
        [0b01111111,
            0b01000001,
            0b01000001,
            0b00111110,
            0b00000000],
        [0b01111111,
            0b01001001,
            0b01001001,
            0b01000001,
            0b00000000],
        [0b01111111,
            0b00001001,
            0b00001001,
            0b00000001,
            0b00000000],
        [0b00111110,
            0b01000001,
            0b01001001,
            0b01111010,
            0b00000000],
        [0b01111111,
            0b00001000,
            0b00001000,
            0b01111111,
            0b00000000],
        [0b01000001,
            0b01111111,
            0b01000001,
            0b00000000],
        [0b00110000,
            0b01000000,
            0b01000001,
            0b00111111,
            0b00000000],
        [0b01111111,
            0b00001000,
            0b00010100,
            0b01100011,
            0b00000000],
        [0b01111111,
            0b01000000,
            0b01000000,
            0b01000000,
            0b00000000],
        [0b01111111,
            0b00000010,
            0b00001100,
            0b00000010,
            0b01111111,
            0b00000000],
        [0b01111111,
            0b00000100,
            0b00001000,
            0b00010000,
            0b01111111,
            0b00000000],
        [0b00111110,
            0b01000001,
            0b01000001,
            0b00111110,
            0b00000000],
        [0b01111111,
            0b00001001,
            0b00001001,
            0b00000110,
            0b00000000],
        [0b00111110,
            0b01000001,
            0b01000001,
            0b10111110,
            0b00000000],
        [0b01111111,
            0b00001001,
            0b00001001,
            0b01110110,
            0b00000000],
        [0b01000110,
            0b01001001,
            0b01001001,
            0b00110010,
            0b00000000],
        [0b00000001,
            0b00000001,
            0b01111111,
            0b00000001,
            0b00000001,
            0b00000000],
        [0b00111111,
            0b01000000,
            0b01000000,
            0b00111111,
            0b00000000],
        [0b00001111,
            0b00110000,
            0b01000000,
            0b00110000,
            0b00001111,
            0b00000000],
        [0b00111111,
            0b01000000,
            0b00111000,
            0b01000000,
            0b00111111,
            0b00000000],
        [0b01100011,
            0b00010100,
            0b00001000,
            0b00010100,
            0b01100011,
            0b00000000],
        [0b00000111,
            0b00001000,
            0b01110000,
            0b00001000,
            0b00000111,
            0b00000000],
        [0b01100001,
            0b01010001,
            0b01001001,
            0b01000111,
            0b00000000],
        [0b01111111,
            0b01000001,
            0b00000000],
        [0b00000001,
            0b00000110,
            0b00011000,
            0b01100000,
            0b00000000],
        [0b01000001,
            0b01111111,
            0b00000000],
        [0b01000000,
            0b01000000,
            0b01000000,
            0b01000000,
            0b00000000],
        [0b00000001,
            0b00000010,
            0b00000000],
        [0b00100000,
            0b01010100,
            0b01010100,
            0b01111000,
            0b00000000],
        [0b01111111,
            0b01000100,
            0b01000100,
            0b00111000,
            0b00000000],
        [0b00111000,
            0b01000100,
            0b01000100,
            0b00101000,
            0b00000000],
        [0b00111000,
            0b01000100,
            0b01000100,
            0b01111111,
            0b00000000],
        [0b00111000,
            0b01010100,
            0b01010100,
            0b00011000,
            0b00000000],
        [0b00000100,
            0b01111110,
            0b00000101,
            0b00000000],
        [0b10011000,
            0b10100100,
            0b10100100,
            0b01111000,
            0b00000000],
        [0b01111111,
            0b00000100,
            0b00000100,
            0b01111000,
            0b00000000],
        [0b01000100,
            0b01111101,
            0b01000000,
            0b00000000],
        [0b01000000,
            0b10000000,
            0b10000100,
            0b01111101,
            0b00000000],
        [0b01111111,
            0b00010000,
            0b00101000,
            0b01000100,
            0b00000000],
        [0b01000001,
            0b01111111,
            0b01000000,
            0b00000000],
        [0b01111100,
            0b00000100,
            0b01111100,
            0b00000100,
            0b01111000,
            0b00000000],
        [0b01111100,
            0b00000100,
            0b00000100,
            0b01111000,
            0b00000000],
        [0b00111000,
            0b01000100,
            0b01000100,
            0b00111000,
            0b00000000],
        [0b11111100,
            0b00100100,
            0b00100100,
            0b00011000,
            0b00000000],
        [0b00011000,
            0b00100100,
            0b00100100,
            0b11111100,
            0b00000000],
        [0b01111100,
            0b00001000,
            0b00000100,
            0b00000100,
            0b00000000],
        [0b01001000,
            0b01010100,
            0b01010100,
            0b00100100,
            0b00000000],
        [0b00000100,
            0b00111111,
            0b01000100,
            0b00000000],
        [0b00111100,
            0b01000000,
            0b01000000,
            0b01111100,
            0b00000000],
        [0b00011100,
            0b00100000,
            0b01000000,
            0b00100000,
            0b00011100,
            0b00000000],
        [0b00111100,
            0b01000000,
            0b00111100,
            0b01000000,
            0b00111100,
            0b00000000],
        [0b01000100,
            0b00101000,
            0b00010000,
            0b00101000,
            0b01000100,
            0b00000000],
        [0b10011100,
            0b10100000,
            0b10100000,
            0b01111100,
            0b00000000],
        [0b01100100,
            0b01010100,
            0b01001100,
            0b00000000],
        [0b00001000,
            0b00110110,
            0b01000001,
            0b00000000],
        [0b01111111,
            0b00000000],
        [0b01000001,
            0b00110110,
            0b00001000,
            0b00000000],
        [0b00001000,
            0b00000100,
            0b00001000,
            0b00000100,
            0b00000000],
        [0b00000010,
            0b00000001,
            0b00000010,
            0b00000000]]

}
