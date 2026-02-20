import { Container, Text } from "pixi.js";
import { CHAT_BUBBLE_DURATION_MS } from "@shireland/shared";

export class ChatBubble {
  readonly container: Container;
  private text: Text;
  private elapsed = 0;
  private duration: number;

  constructor(message: string, duration = CHAT_BUBBLE_DURATION_MS) {
    this.duration = duration;

    this.container = new Container();

    this.text = new Text(message.slice(0, 40), {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 13,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 3,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 160,
    });
    this.text.anchor.set(0.5, 1);

    this.container.addChild(this.text);
  }

  /** Returns true when bubble should be removed */
  update(dt: number): boolean {
    this.elapsed += dt;

    // Fade out in last second
    const fadeStart = this.duration - 1000;
    if (this.elapsed > fadeStart) {
      this.container.alpha = Math.max(0, 1 - (this.elapsed - fadeStart) / 1000);
    }

    return this.elapsed >= this.duration;
  }
}
