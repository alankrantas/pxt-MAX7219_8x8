MAX7219_Matrix.setup(
4,
DigitalPin.P16,
DigitalPin.P15,
DigitalPin.P14,
DigitalPin.P13
)
basic.forever(function () {
    MAX7219_Matrix.scrollText(
    "Hello world!",
    50,
    50
    )
    for (let index = 0; index <= 23; index++) {
        MAX7219_Matrix.displayCustomCharacter(
        MAX7219_Matrix.getCustomCharacterArray(
        "B00100000,B01000000,B10000110,B10000000,B10000000,B10000110,B01000000,B00100000"
        ),
        index,
        true
        )
        basic.pause(50)
    }
})
