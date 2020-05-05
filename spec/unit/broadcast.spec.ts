import broadcast from "../../src/lib/broadcast";

type FakeFrame = {
  postMessage: jest.SpyInstance;
  frames: FakeFrame[];
  closed: boolean;
  opener?: FakeFrame;
  parent?: Window | FakeFrame;
  top?: Window | FakeFrame;
};

function mkFrame(): FakeFrame {
  return {
    ...window,
    postMessage: jest.fn(),
    frames: [],
    closed: false,
  };
}

describe("broadcast", function () {
  it("should not throw exception when postMessage is denied", function () {
    const frame = mkFrame();

    frame.postMessage.mockImplementation(() => {
      throw new Error("Invalid calling object");
    });

    expect(function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      broadcast(frame as any, "payload", "*");
    }).not.toThrowError();
  });

  it("should postMessage to current frame", function () {
    const frame = mkFrame();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    broadcast(frame as any, "payload", "*");

    expect(frame.postMessage).toBeCalled();
  });
  it("should postMessage to current frame's child frames", function () {
    const frame = mkFrame();

    frame.frames.push(mkFrame());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    broadcast(frame as any, "payload", "*");

    expect(frame.frames[0].postMessage).toBeCalled();
  });

  describe("to opener", function () {
    it("should postMessage to window.top.opener if it exists", function () {
      const frame = mkFrame();

      frame.opener = mkFrame();
      frame.top = frame;
      frame.opener.top = frame.opener;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      broadcast(frame as any, "payload", "*");

      expect(frame.opener.top.postMessage).toBeCalled();
    });

    it("should not postMessage to window.opener if it has closed", function () {
      const frame = mkFrame();

      frame.opener = {
        postMessage: jest.fn(),
        frames: [],
        closed: true,
      };
      frame.opener.top = frame.opener;
      frame.top = frame;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      broadcast(frame as any, "payload", "*");

      expect(frame.opener.top.postMessage).not.toBeCalled();
    });

    it("should not infinitely recurse if opener is itself", function (done) {
      const frame = mkFrame();

      jest.setTimeout(10);
      frame.opener = frame;
      frame.top = frame;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      broadcast(frame as any, "payload", "*");

      // don't infinitely recurse
      done();
    });

    it("should not infinitely recurse if opener is parent", function (done) {
      const frame = mkFrame();
      const child = mkFrame();

      child.opener = frame;
      child.parent = frame;
      child.top = frame;

      frame.frames = [child];
      frame.top = frame;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      broadcast(frame as any, "payload", "*");

      // don't infinitely recurse
      done();
    });

    it("should postMessage to the window.opener's child frames", function () {
      const frame = mkFrame();
      const openerFrame = mkFrame();

      openerFrame.frames.push(mkFrame());

      frame.opener = openerFrame;
      frame.opener.top = frame.opener;
      frame.top = frame;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      broadcast(frame as any, "payload", "*");

      expect(frame.opener.top.frames[0].postMessage).toBeCalled();
    });

    it("should not throw if window.opener has access denied", function () {
      const frame = mkFrame();

      frame.top = frame;

      Object.defineProperty(frame, "opener", {
        get: function () {
          throw new Error("Access denied");
        },
      });

      expect(function () {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        broadcast(frame as any, "payload", "*");
      }).not.toThrowError("Access denied");
    });
  });
});