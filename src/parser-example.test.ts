

// to track progress through our input string.

import {Option} from "fp-ts/lib/Option"
import * as O from "fp-ts/lib/Option"

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

type Char = string
type Digit = number
const toNumber = (c: Char): Option<Digit> => {
  const num = parseInt(c);
  return isNaN(num)? O.none: O.some(num);
}

const parseDigit: Parser<Digit> = (ctx: Context) => {
  const charResult = parseChar(ctx);
  if (charResult.success) {
    const digitResult = toNumber(charResult.value)
    return O.fold<Digit, Result<Digit>>(
      () => failure(ctx, "not a digit"),
      (d) => success(charResult.ctx, d))
      (digitResult);
  }
  return charResult; // Failure
}


describe('parseDigit', () => {
  test('fails when there are no characters', () => {
    const cxt = {text: "", index:0};
    const result = parseDigit(cxt);
    expect(result).toEqual(failure(cxt, "no characters"))
  });

  test('fails when there are no digits', () => {
    const cxt = {text: "abc", index:0};
    const result = parseDigit(cxt);
    expect(result).toEqual(failure(cxt, "not a digit"))
  });

  test('succeeds when there are is a digit', () => {
    const cxt = {text: "723abc", index:0};
    const result = parseDigit(cxt);
    expect(result).toEqual(success(moveIndex(cxt, 1), 7))
  });
})

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

// Parses A, then B. Successful if both are successful, fails if either fail.
const sequential = <A,B>(parserA: Parser<A>, parserB: Parser<B>): Parser<[A, B]> => 
  (ctx: Context) => {
    const resultA: Result<A> = parserA(ctx);
    if (resultA.success) {
      const resultB = parserB(resultA.ctx);
      if (resultB.success) {
        const successResult: Success<[A,B]> = success(resultB.ctx, [resultA.value, resultB.value])
        return successResult;
      }
    }
    const failureResult = failure(ctx, "could not parse A then B")
    return failureResult;
  }


// List.Reduce Parser<T[]>
const parseUpToNReduce: <T>(parser: Parser<T>, max: number)=> Parser<T[]> = <T>(parser: Parser<T>, max: number): Parser<T[]> =>
(ctx: Context) => {
  if (max < 0)
    throw "InvalidparseUpToNReduceuse of parseUpToNV2";

  if (max === 0) {
    return success(ctx, []);
  }

  const a = Array(max).fill(parser);

  const initialValue: Success<T[]> = success(ctx, []);
  const reducer = (prev: Success<T[]>, current: Parser<T>) => {
    const r1: Result<T> = current(prev.ctx);
    return r1.success?
       success(r1.ctx, prev.value.concat([r1.value]))
       : prev;
  };
  const result: Success<T[]> = a.reduce(reducer, initialValue)
  return result;
}

const map = <A,B>(parserA: Parser<A>, f: (a:A) => B): Parser<B> => {
  return (ctx: Context) => {
    const aResult = parserA(ctx);
    return aResult.success?
      success(aResult.ctx, f(aResult.value)) :
      aResult;
  }
}

const parseAtLeastOne = <A>(parserOne: Parser<A>, parserZeroOrMany: Parser<A[]>): Parser<A[]> =>
  map(sequential(parserOne, parserZeroOrMany), (a: [A, A[]]) => [a[0]].concat(a[1]));


describe('parseAtLeastOne', () => {
  test('if no A fails', () => {
    const ctx = {text: "abc", index:0};
    const parser = parseAtLeastOne<number>(parseDigit, parseUpToNReduce(parseDigit, 1000));
    const result = parser(ctx);
    expect(result).toEqual(failure(ctx, "could not parse A then B"));
  })

  test('if one A succeeds', () => {
    const ctx = {text: "8bc", index:0};
    const parser = parseAtLeastOne<number>(parseDigit, parseUpToNReduce(parseDigit, 1000));
    const result = parser(ctx);
    expect(result).toEqual(success(moveIndex(ctx, 1), [8]));
  })

  test('if many A succeeds', () => {
    const ctx = {text: "814c", index:0};
    const parser = parseAtLeastOne<number>(parseDigit, parseUpToNReduce(parseDigit, 1000));
    const result = parser(ctx);
    expect(result).toEqual(success(moveIndex(ctx, 3), [8, 1, 4]));
  })
})

const parseInteger: Parser<number> = 
  map(
    parseAtLeastOne<number>(parseDigit, parseUpToNReduce(parseDigit, 1000)),
    (digits: Digit[]) => parseInt(digits.join('')));

describe('parseInteger', () => {
  test('if no digits fails', () => {
    const ctx = {text: "abc", index:0};
    const result = parseInteger(ctx);
    expect(result).toEqual(failure(ctx, "could not parse A then B"));
  })

  test('if one digit succeeds', () => {
    const ctx = {text: "8bc", index:0};
    const result = parseInteger(ctx);
    expect(result).toEqual(success(moveIndex(ctx, 1), 8));
  })

  test('if many digits succeeds', () => {
    const ctx = {text: "814c", index:0};
    const parser = parseAtLeastOne<number>(parseDigit, parseUpToNReduce(parseDigit, 1000));
    const result = parseInteger(ctx);
    expect(result).toEqual(success(moveIndex(ctx, 3), 814));
  })
})

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


describe('map', () => {

  // Warning: since parseInt can fail, this isn't a good idea because exceptions get throw.
  // Purely illustrative of map.
  test('maps entity inside the parser', () => {
    const ctx = {text:"123", index:0};
    const parser: Parser<string> =  parseString("123");
    const f = (s: string) => parseInt(s)
    const numberParser: Parser<number> = map(parser, f);
    expect(numberParser(ctx)).toEqual(success({text:"123", index:3}, 123))
  })
})


// Recursive Parser<T[]>
const parseUpToNRecursive: <T>(parser: Parser<T>, max: number)=> Parser<T[]> = <T>(parser: Parser<T>, max: number): Parser<T[]> =>
(ctx: Context) => {
  if (max < 0)
    throw "Invalid use of parseUpToNRecursive";

  if (max === 0) {
    return success(ctx, []);
  }

  const r1 = parser(ctx);

  if (r1.success) {
    const r2: Success<T[]> = success(r1.ctx, [r1.value])
    const theRest = parseUpToNRecursive(parser, max - 1)(r1.ctx);

    return theRest.success ?
      success(theRest.ctx, r2.value.concat(theRest.value)): 
      r2;
  } else {
    return success(ctx, [])
  }
}



describe('parseUpToNRecursive', () => {
  test('return success if there is nothing to parse', () => {
    const ctx = {text:"", index:0};
    const charParser: Parser<string> = parseChar;
    const parser: Parser<string[]> =  parseUpToNRecursive(charParser, 1);

    const result = parser(ctx);

    expect(result).toEqual(success(ctx, []));
  })

  test('returns success if there is one to parse', () => {
    const ctx = {text:"a", index:0};
    const charParser: Parser<string> = parseChar;
    const parser: Parser<string[]> =  parseUpToNRecursive(charParser, 1);

    const result = parser(ctx);

    const endCxt = {text: "a", index: 1};
    expect(result).toEqual(success(endCxt, ["a"]))
  })

  test('returns success if there is more than 1 to parse', () => {
    const ctx = {text:"abc", index:0};
    const charParser: Parser<string> = parseChar;
    const parser: Parser<string[]> =  parseUpToNRecursive(charParser, 2);

    const result = parser(ctx);

    const endCxt = {text: "abc", index: 2};
    expect(result).toEqual(success(endCxt, ["a", "b"]))
  })

})


describe('parseUpToNReduce', () => {
  test('return success if there is nothing to parse', () => {
    const ctx = {text:"", index:0};
    const charParser: Parser<string> = parseChar;
    const parser: Parser<string[]> =  parseUpToNReduce(charParser, 1);

    const result = parser(ctx);

    expect(result).toEqual(success(ctx, []));
  })

  test('returns success if there is one to parse', () => {
    const ctx = {text:"a", index:0};
    const charParser: Parser<string> = parseChar;
    const parser: Parser<string[]> =  parseUpToNReduce(charParser, 1);

    const result = parser(ctx);

    const endCxt = {text: "a", index: 1};
    expect(result).toEqual(success(endCxt, ["a"]))
  })

  test('returns success if there is more than 1 to parse', () => {
    const ctx = {text:"abc", index:0};
    const charParser: Parser<string> = parseChar;
    const parser: Parser<string[]> =  parseUpToNReduce(charParser, 2);

    const result = parser(ctx);

    const endCxt = {text: "abc", index: 2};
    expect(result).toEqual(success(endCxt, ["a", "b"]))
  })

  test('returns success if there is less than n', () => {
    const ctx = {text:"abc", index:0};
    const charParser: Parser<string> = parseChar;
    const parser: Parser<string[]> =  parseUpToNReduce(charParser, 5);

    const result = parser(ctx);

    const endCxt = {text: "abc", index: 3};
    expect(result).toEqual(success(endCxt, ["a", "b", "c"]))
  })

})

