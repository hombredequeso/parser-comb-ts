

// to track progress through our input string.
// we should make this immutable, because we can.
type Context = Readonly<{
  text: string; // the full input string
  index: number; // our current position in it
}>;

const moveIndex = (ctx: Context, count: number) => (
  {
    text: ctx.text,
    index: ctx.index + count
  });

// our result types
type Result<T> = Success<T> | Failure;

// on success we'll return a value of type T, and a new Ctx
// (position in the string) to continue parsing from
type Success<T> = Readonly<{
  success: true;
  value: T;
  ctx: Context;
}>;

// when we fail we want to know where and why
type Failure = Readonly<{
  success: false;
  expected: string;
  ctx: Context;
}>;

// every parsing function will have this signature
type Parser<T> = (ctx: Context) => Result<T>;


// some convenience methods to build `Result`s for us
const success : <T>(ctx: Context, value: T) => Success<T> = <T>(ctx: Context, value: T): Success<T> => {
  return { success: true, value, ctx };
}

const failure = (ctx: Context, expected: string): Failure => {
  return { success: false, expected, ctx };
}

const parseChar: Parser<string> = (ctx: Context) => {
  if (ctx.text.length > ctx.index) {
    return success(
      moveIndex(ctx, 1),
      ctx.text[ctx.index])
  }
  return failure(ctx, "no characters");
}

const parseString: (s: string) => Parser<string> = (s: string) => (ctx: Context) => {
  if (ctx.index + s.length <= ctx.text.length) {
    if (ctx.text.substring(ctx.index, ctx.index + s.length) === s) {
      return success(moveIndex(ctx, s.length), s);
    }
  }
  return failure(ctx, "no characters");
};

describe('parseChar', () => {
  test('fails when there are no characters', () => {
    const cxt = {text: "", index:0};
    const parser = parseChar;
    const result = parser(cxt);
    expect(result).toEqual(failure(cxt, "no characters"))
  });

  test('succeeds for a single character', () => {
    const cxt = {text: "a", index:0};
    const parser = parseChar;
    const result = parser(cxt);
    
    const endCxt = {text: "a", index: 1};
    expect(result).toEqual(success(endCxt, "a"))
  });
});

describe('parseString', () => {

  test('fails when there are not enough characters', () => {
    const cxt = {text: "", index:0};
    const parser = parseString("abc");
    const result = parser(cxt);
    expect(result).toEqual(failure(cxt, "no characters"));
  });


  test('succeeds for abc', () => {
    const cxt = {text: "abcd", index:0};
    const parser = parseString("abc");
    const result = parser(cxt);
    const endCxt = {text: "abcd", index: 3};
    expect(result).toEqual(success(endCxt, "abc"))
  });
})


const lift = <T>(value: T): Parser<T> => 
  (ctx) => success(ctx, value);

describe('lift', () => {
  test('lifts a value into the context of a parser', () => {
    const ctx = {text: "", index:0};
    const parser = lift(["abc", 1]);
    const result = parser(ctx);
    expect(result).toEqual(success(ctx, ["abc", 1]));
  });
})


// This is one of the key elements of the famous monad (be very afraid)
// Note the structure of the signature, replacing Parser with W
// (x: W<A>, f: (a:A) => W<B>): W<B>
// You already use it. It's Array.flatMap
// (x: A[], f: (a:A) => B[]): B[]
// Although usually expressed in OO form where x is the 'this' object.
const bind = <A,B>(parserA: Parser<A>, f: (a:A) => Parser<B>): Parser<B> => 
  (ctx: Context) => {
    const resultA: Result<A> = parserA(ctx);
    const resultB: Result<B> = resultA.success?
      f(resultA.value)(resultA.ctx):
      resultA;
    return resultB;
  }

describe('bind', () => {

  test('bind sequentially parses part1 then part2', () => {
    const ctx = {text: "abcxyz", index:0};
    const part1Parser = parseString("abc");
    const part2Parser = parseString("xyz");

    const f = (s: String) => part2Parser;

    const bothParsers: Parser<String> = bind(part1Parser, f);
    const result = bothParsers(ctx);

    expect(result).toEqual(success({text: "abcxyz", index:6}, "xyz"))
  })

  test('put it all together', () => {
    const ctx = {text: "abcxyz", index:0};
    const part1Parser = parseString("abc");
    const part2Parser = parseString("xyz");

    const f = (s: String) => part2Parser;

    const bothParsers: Parser<string[]> = 
      bind(
        part1Parser, 
        part1 => bind(
            part2Parser,
            part2 => lift([part1, part2])
          )
      );
    const result = bothParsers(ctx);

    expect(result).toEqual(success({text: "abcxyz", index:6}, ["abc", "xyz"]))
  })
})

const alternative = <A>(parser1: Parser<A>, parser2: Parser<A>): Parser<A> => 
  (ctx: Context) => {
    const result1: Result<A> = parser1(ctx);
    const result: Result<A> = result1.success? result1 : parser2(ctx)
    return result;
  };


describe('alternative tests', () => {

  test('fails if no match', () => {
    const ctx = {text: "zzzzzzzzzz", index:0};
    const part1Parser = parseString("abcd");
    const part2Parser = parseString("xyz");

    const altParser = alternative(parseString("abc"), parseString("xyz"));

    expect(altParser(ctx)).toEqual(failure({text: "zzzzzzzzzz", index:0}, "no characters"));
  })


  test('fails if no match', () => {
    const ctx = {text: "abcdzzzz", index:0};
    const altParser = alternative(parseString("abcd"), parseString("xyz"));

    expect(altParser(ctx)).toEqual(success({text: "abcdzzzz", index:4}, "abcd"));
  })


  test('fails if no match', () => {
    const ctx = {text: "xyzazzz", index:0};
    const altParser = alternative(parseString("abcd"), parseString("xyz"));

    expect(altParser(ctx)).toEqual(success({text: "xyzazzz", index:3}, "xyz"));
  })
})

const map = <A,B>(parserA: Parser<A>, f: (a:A) => B): Parser<B> => {
  return (ctx: Context) => {
    const aResult = parserA(ctx);
    return aResult.success?
      success(aResult.ctx, f(aResult.value)) :
      aResult;
  }
}

describe('map', () => {

  test('maps entity inside the parser', () => {
    const ctx = {text:"123", index:0};
    const parser: Parser<string> =  parseString("123");
    const f = (s: string) => parseInt(s)
    const numberParser: Parser<number> = map(parser, f);
    expect(numberParser(ctx)).toEqual(success({text:"123", index:3}, 123))
  })
})
