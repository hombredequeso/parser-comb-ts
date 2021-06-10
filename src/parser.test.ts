

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
  ctx: Ctx;
}>;

// when we fail we want to know where and why
type Failure = Readonly<{
  success: false;
  expected: string;
  ctx: Ctx;
}>;

// every parsing function will have this signature
type Parser<T> = (ctx: Context) => Result<T>;


// some convenience methods to build `Result`s for us
function success<T>(ctx: Context, value: T): Success<T> {
  return { success: true, value, ctx };
}

function failure(ctx: Context, expected: string): Failure {
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
    console.log('right lenght')
    if (ctx.text.substring(ctx.index, ctx.index + s.length) === s) {
      console.log('right text')
      return success(moveIndex(ctx, s.length), s);
    }
  }
  return failure(ctx, "no characters");
};

const constParser = <A,B>(a:A,b:B) => {
  return (ctx: Context) => {
    return success(ctx, [a,b])
  };
}

function andThen<A,B>(parserA: Parser<A>, f: (a:A) => Parser<B>): Parser<B> {
  return (ctx: Context) => {
    const aResult = parserA(ctx);
    return aResult.success?
      f(aResult.value)(aResult.ctx):
      aResult;
  }
}

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

describe('constParser', () => {

  test('consumes no input and returns what it got', () => {
    const ctx = {text: "", index:0};
    const parser = constParser("abc", 1);
    const result = parser(ctx);
    expect(result).toEqual(success(ctx, ["abc", 1]));
  });
})

describe('andThen', () => {

  test('andThen sequentially parses part1 then part2', () => {
    const ctx = {text: "abcxyz", index:0};
    const part1Parser = parseString("abc");
    const part2Parser = parseString("xyz");

    const f = (s: String) => part2Parser;

    const bothParsers: Parser<String> = andThen(part1Parser, f);
    const result = bothParsers(ctx);

    expect(result).toEqual(success({text: "abcxyz", index:6}, "xyz"))
  })

  test('put it all together', () => {
    const ctx = {text: "abcxyz", index:0};
    const part1Parser = parseString("abc");
    const part2Parser = parseString("xyz");

    const f = (s: String) => part2Parser;

    const bothParsers: Parser<String> = 
      andThen(
        part1Parser, 
        part1 => andThen(
            part2Parser,
            part2 => constParser(part1, part2)
          )
        
      );
    const result = bothParsers(ctx);

    expect(result).toEqual(success({text: "abcxyz", index:6}, ["abc", "xyz"]))
  })
})

function alternative<A>(parser1: Parser<A>, parser2: Parser<A>): Parser<A> {
  return (ctx: Context) => {
    const result1 = parser1(ctx);
    return result1.success? result1 : parser2(ctx)
  };
}


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
