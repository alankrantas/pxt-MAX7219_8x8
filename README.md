# BBC micro:bit MakeCode editor extension for MAX7219 8x8 matrix LED modules

This extension works with single or multiple MAX7219 8x8 LED matrix display modules. Add this extension by go to Advanced -> +extension and copy/paste [https://github.com/alankrantas/pxt-MAX7219_8x8](https://github.com/alankrantas/pxt-MAX7219_8x8) into the search box. Press enter and click the extension to download it.

![led-matrix-display-8x8-dots-rood-max7219-bovenkant](https://user-images.githubusercontent.com/44191076/50701188-d0ba2400-1087-11e9-9588-d57f678010d7.jpg)

![img_0005](https://user-images.githubusercontent.com/44191076/50698899-3fe04a00-1081-11e9-95c8-de5ba55b44d9.JPG)

![1](https://user-images.githubusercontent.com/44191076/50700935-eda22780-1086-11e9-8d7a-0fd285bd5a2d.jpg)

## Modules Wiring

For the first module, connect it to micro:bit as follows:

* VCC -> 3V
* GND -> GND
* DIN (LOAD pin) -> any pin you want (in the example we used P16)
* CS (MOSI or MO in SPI) -> P15
* CLK (SCK in SPI) -> P13

MISO (P14) is not used.

Of course, you can reassign these SPI pins in anyway you want; just use the setup block.

![img_0003](https://user-images.githubusercontent.com/44191076/50699442-d95c2b80-1082-11e9-8f68-9f0b0a47eeb4.JPG)

The rest of the modules (if any) connect as follows:

![untitled sketch_bb](https://user-images.githubusercontent.com/44191076/50699433-d103f080-1082-11e9-84a6-e5323c2e706c.png)

It's basicly the same as the first one, except all module's DIN connects to DOUT on the previous one.

In my test the 3.3V power from micro:bit itself (90mA) is enough to power 4 MAX7219 modules. You may need more for a longer matrix chain.

## Modules Index

This extension assumes that you arrange MAX7219 modules in a "chain", that they linked into a larger horizonal LED display.

The one nearest to micro:bit on the left has the highest index number (total num - 1), and the furthest one (far right) has index of 0.

![img_0004](https://user-images.githubusercontent.com/44191076/50699988-5e941000-1084-11e9-841e-5ff173872540.JPG)

## Display Mode: Text Printing

There are currently two display modes supported.

First is the simple text printing mode; it will use the whole LED display to show or scroll a string.

![microbit-screenshot](https://user-images.githubusercontent.com/44191076/50701355-84bbaf00-1088-11e9-9744-1df09ab2f2cd.png)

![img_0002](https://user-images.githubusercontent.com/44191076/50700052-88e5cd80-1084-11e9-843f-2fa339c39b6f.JPG)

The scrolling text block shows the whole sentence by scrolling it from right to left, speed is adjustable. However, the program will not contiune to do anything until scrolling is finished.

The display text block prints words on the LED display without (perceivable) delay, and you can choose offset (the starting point along the LED display). This is more sutiable for very short texts or characters, and you can print them seperatly along the LED display. (You may have to set the clear screen option as false.)

You can also print a custom character or image on the LED display. Use [this 8x8 LED generator](http://robojax.com/learn/arduino/8x8LED/) (right side is "up") and copy the byte array as input string. Paste the text in the block you find in "more" section; it would transform the text into a number array which can be used to print special characters.

![3](https://user-images.githubusercontent.com/44191076/50700687-2261af00-1086-11e9-8451-aff7c771dc64.jpg)

![microbit-screenshot 3](https://user-images.githubusercontent.com/44191076/50702213-31972b80-108b-11e9-928e-9e4a991c5dbb.png)

![img_0001](https://user-images.githubusercontent.com/44191076/50700621-ff36ff80-1085-11e9-942d-0ef1c3cef84f.JPG)

So far the extension only contains a simple ASCII character library. However, you can add custom character or images into the library by using some unusual [Unicode characters](https://en.wikipedia.org/wiki/List_of_Unicode_characters) as tokens.

## Display Mode: Matrix Setting

The second mode allows you to get/modify a 8x8 number array variable and use it to directly set any or all of the modules.

Due to the nature of the control method of MAX7219s, it is actually harder to toggle a single LED on the 8x8 matrix. (They set one whole column at a time.) So is this mode you'll have to keep track the status of all LEDs by youself. The example below will show a anti-slash line on module 1 (second from the right).

![microbit-screenshot 2](https://user-images.githubusercontent.com/44191076/50701394-9f8e2380-1088-11e9-9d71-376778ea8d74.png)

It would be easier if you modify the 8x8 array variable in JavaScript mode.

## License

MIT

## Supported targets

* for PXT/microbit
(The metadata above is needed for package search.)
