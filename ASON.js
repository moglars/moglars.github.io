/*jshint node: true*/
/*jslint node: true*/

(function () {
    "use strict";
    //TODO no escaping for quotation mark backslash solidus
    //-------------------------------COMMON
    /**
    Used to match strings that could be
    interpreted as primitives but are escaped
    to enforce string representation
    */
    var primitiveEscapeSequenceRegEx = /^(\\*)(null|true|false|-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+\-]?[0-9]+)?)$/;

    /**
    Splits a string at newLine characters and
    returns an array of lines
    **/
    var getLines = function (text) {
        return text.split("\n");
    };

    /**
    Counts the space characters in front of a string
    **/
    var getLevel = function (line) {
        return line.match(/^\ */)[0].length;
    };

    var indexOfFirstUnescapedSpace = function (text) {
        return text.replace(/\\\ /g, "__").indexOf(" ");
    };

    var levelToSpace = function (level) {
        var space = "";
        while (level > 0) {
            space += " ";
            level -= 1;
        }
        return space;
    };

    /**
    Converts primitive values to string.
    Infinity and NaN are converted to "null".
    If argument is not primitive, method returns null.
    */
    var convertPrimitiveToString = function (value) {
            //Treat INFINITY or NaN as null
        //"NaN, and only NaN, will compare unequal to itself" -> hubelibubeli
        if (value === Infinity || Number.isNaN(value)) {
            return "null";
        }
        //JSON.stringify interprets INFINITY and NaN as null. if value of key is undefined, the key is ignored.
        //TODO also ignore key if value is undefined (has to be checked elsewhere)

        //Convert primitives to string
        if (value === null || value === true || value === false || typeof value === "number") {
            return "" + value;
        }

        return null;
    };
    //-------------------------------COMMON END

    //-------------------------------ESCAPING
    /**
    Converts a string from json. The chars of the resulting string are not escaped
    */
    var unescapeFromJson = function (text, ason) {
        var specialMapping;
        if (ason) {
            specialMapping = {
                "\\n": "\n"
            };
        } else {
            //map escape sequence to char
            specialMapping = {
                "\\\"": "\"",
                "\\\\": "\\",
                "\\/": "/",
                "\\b": "\b",
                "\\f": "\f",
                "\\n": "\n",
                "\\r": "\r",
                "\\t": "\t"
            };
        }

        //output
        var unescapedString = "";

        //search index
        var escapeSequenceIndex = -1;
        var newIndex;
        var escapeSequence;
        var specialChar;
        var matchResult;
        var codePoint;
        while (true) {
            //find escape sequence
            newIndex = text.indexOf("\\", escapeSequenceIndex);

            //no action if no escape sequence found
            if (newIndex === -1) {
                break;
            }

            //add text from previous index to new index (exclusive) to unescapedString
            unescapedString += text.substring(escapeSequenceIndex, newIndex);

            //work now with new index
            escapeSequenceIndex = newIndex;

            //get char from mapping if possible
            escapeSequence = text.substr(escapeSequenceIndex, 2);
            specialChar = specialMapping[escapeSequence];

            //if char is from mapping
            if (specialChar !== undefined) {
                //Add it to unescapedString
                unescapedString += specialChar;
                //next search begins at escapeSequenceIndex plus 2
                escapeSequenceIndex += 2;
            } else {
                //Check if it is a code point escape sequence
                matchResult = text.substr(escapeSequenceIndex, 6).match(/^\\u([0-9A-Fa-f]{4})$/);
                if (matchResult !== null) {
                    //Add the character the code point represents to unescapedString
                    codePoint = matchResult[1];
                    unescapedString += String.fromCharCode(parseInt(codePoint, 16));
                    escapeSequenceIndex += 6;
                } else {
                    if (ason) {
                        //!Non-standard: as long as unescaping is only done for ason text, a backslash that
                        //doesn't escape a specific char should not be ignored. Instead, it is printed:
                        unescapedString += "\\";
                        escapeSequenceIndex += 1;
                    } else {
                        //otherwise, just ignore the backslash
                        escapeSequenceIndex += 1;
                    }
                }
            }
        }

        //add the rest to unescapedString
        unescapedString += text.substring(escapeSequenceIndex);
        return unescapedString;
    };

    /**
    Converts a normal string. The chars of the resulting string are json compliant escaped
    */
    var escapeToJson = function (text, ason) {
        var escapedString = "";
        var specialMapping;
        var uEscaping;
        if (ason) {
            specialMapping = {
                "\n": "\\n"
            };
            uEscaping = /[\u0000-\u001F]/;
        } else {
            //map char to escape sequence
            specialMapping = {
                "\"": "\\\"",
                "\\": "\\\\",
                // "/": "\\/", //is optional in JSON specification
                "\b": "\\b",
                "\f": "\\f",
                "\n": "\\n",
                "\r": "\\r",
                "\t": "\\t"
            };
            uEscaping = /[\u0000-\u0007\u000B\u000E-\u001F]/;
        }

        //not applicable here, but very insightful: https://mathiasbynens.be/notes/javascript-unicode
        text.split('').forEach(function (character) {
            if (specialMapping[character] !== undefined) {
                escapedString += specialMapping[character];
            } else if (uEscaping.test(character)) {
                var codePoint = character.codePointAt(0);
                var hex = ("0000" + codePoint.toString(16)).slice(-4);
                escapedString += "\\u" + hex;
            } else {
                escapedString += character;
            }
        });

        return escapedString;
    };



    /**
    Converts a normal string to an ason key string.
    Json escaping is applied.
    Furthermore, spaces are escaped.
    */
    var convertStringToAsonKeyString = function (str) {
        //if string could be interpreted as a key for an empty sequence or map, add a backslash to avoid that
        var matchResult = str.match(/^(\\*)([\.\-].*)/);
        var backslashesInFront = "";
        if (matchResult !== null) {
            backslashesInFront = "\\" + matchResult[1];
            str = matchResult[2];
        }
        return backslashesInFront + escapeToJson(str).replace(/\ /g, "\\ ");
    };

    // var convertJsonValueFormatToObjectValue = function (str) {
        //must probably be implemented when json will be parsed without external library
    // };

    /**
    Unescapes the spaces in a ason key and applies
    then json unescaping rules. Result will be a normal
    string. All chars will be unescaped.
    For Ason values only the unescapeFromJson method is needed.
    */
    var convertAsonKeyToObjectValue = function (asonKey) {
        return unescapeFromJson(asonKey.replace(/\\\ /g, " "), true);
    };

    /**
    Converts an ASON value to an object value
    that can be a primitive
    */
    var convertAsonValueToObjectValue = function (str) {
        var matchResult = str.match(primitiveEscapeSequenceRegEx);
        if (matchResult !== null) {
            var backslashes = matchResult[1];
            var strContent = matchResult[2];

            if (backslashes.length === 0) {
                //its a primitive.
                if (strContent === "null") {
                    return null;
                } else if (strContent === "true") {
                    return true;
                } else if (strContent === "false") {
                    return false;
                } else {
                    return parseFloat(strContent); //converts number with js standard parseFloat
                }
            } else {
                //remove one backslash and at " chars around it
                return backslashes.slice(1) + strContent;
            }
        }
        return unescapeFromJson(str, true);
    };

    /**
    Converts an object value to a string that represents
    a Json value. In Json, strings have surrounding " chars
    while primitives do not. For keys, the escapeToJson method
    with manually adding " chars can be used.
    */
    var convertObjectValueToJsonValueFormat = function (value) {
        //Convert primitives to string
        var str = convertPrimitiveToString(value);
        if (str !== null) {
            return str;
        }
        //otherwise, escape and surround with " chars
        return '"' + escapeToJson(value) + '"';
    };

    /**
    Converts a value (either string, true, false, number or null)
    from an object to an ason value string.
    Applies json escaping when value is of type string, but does not escape quotation mark.
    If not a string, converts value into string representation.
    */
    var convertObjectValueToAsonValueString = function (value) {
        //Convert primitives to string
        var str = convertPrimitiveToString(value);
        if (str !== null) {
            return str;
        }
        //escaping needed for string representation of primitive types
        var matchResult = value.match(primitiveEscapeSequenceRegEx);
        if (matchResult !== null) {
            //just add a backslash in front
            return "\\" + matchResult[0];
        }

        return escapeToJson(value, true);
    };
    //-------------------------------ESCAPING END

    //--------------------------------TOKENIZING
    /**
    Analyses a string and creates tokens. Possible types:
    - rs (right shift)
    - ls (left shift)
    - c (content)
    A token is an object with at least an attribute type.
    It stores the type as a string (rs, ls or c).
    The token can have a body attribute with additional information:
    - ls tokens store the number of levels to decrease
    - c tokens store the value of the content
    The tokens describe the level of values or in other words:
    The hierarchical structure of data.
    This method returns an array of tokens of type rs, ls or c.
    **/
    var shiftTokenizer = function (text, strict) {
        var lines = getLines(text);
        var tokensRaw = [];
        var level = 0;
        var newLevel;
        var leftShiftCount;

        lines.forEach(function (line) {
            if (strict && line.trim() === "") {
                throw "line must not be empty";
            }
            newLevel = getLevel(line);
            if (newLevel === level + 1) {
                tokensRaw.push({
                    type: 'rs'
                });
                line = line.substr(level + 1);
            } else if (newLevel < level) {
                leftShiftCount = level - newLevel;
                tokensRaw.push({
                    type: 'ls',
                    body: leftShiftCount
                });
                line = line.substr(newLevel);
            } else if (newLevel === level) {
                line = line.substr(newLevel);
            } else {
                throw "unexpected level. Only an indention increase of one space per line is allowed";
            }
            tokensRaw.push({
                type: 'c',
                body: line
            });
            level = newLevel;
        });

        return tokensRaw;
    };

    /**
    This method takes the output of the method shiftTokenizer as
    an argument and analyses it further to create more specialized tokens.
    There are two different contexts: m (map) and s (sequence).
    Start context is m. After a c token (it's a line), a rs token can introduce
    a new context that is pushed into a stack. A ls token pops contexts
    off a stack. Depending on the context, c tokens are interpreted differently.
    If one condition is met, the others are ignored.
    Map-Context:
    - A line that starts with character . and is followed by rs
      creates sk (sequence key) token. Push sequence context into stack.
    - ske is created when the line starting with . character is not followed by rs.
      It depicts an empty sequence.
    - A line followed by rs creates mk (map key) token. Push map context into stack.
    - If there is a space character in the line,
      split at first space and create  k (key) and v (value) tokens
    - Otherwise, create mke (map key element) token, depicting an empty map.
    Sequence-Context:
    - A line starts with a . character. Create s (sequence) token.
    - line is followed by rs. Create am (anonymous map) token. Push map context into stack.
    - Otherwise, create v (value) token, depicting an element of the sequence.
    **/
    var asonTokenizer = function (shiftTokens, strict) {
        var tokens = [];
        var contexts = ['s'];

        var i;
        var context;
        var locToken;
        var content;
        var lookAheadToken;
        var key;
        var firstSpacePosition;
        var value;
        var k;
        var matchResult;
        var backslashesInFront;
        var backslashes;

        i = 0;
        while (i < shiftTokens.length) {
            context = contexts[contexts.length - 1];
            locToken = shiftTokens[i];
            if (locToken.type === 'c') {
                content = locToken.body;
                if (strict && content[content.length - 1] === " ") {
                    throw "no whitespace at the end of the line allowed";
                }
                if (strict && content[content.length - 1] === "\r") {
                    throw "carriage returns not allowed for line breaks";
                }
                if (strict && content.indexOf("\t") !== -1) {
                    throw "no tabs allowed";
                }
                //TODO throw exception if ason tokens contain unescaped special characters: 0000-001F must be escaped.
                if (context === 'm') {
                    lookAheadToken = shiftTokens[i + 1];
                    if (lookAheadToken !== undefined && lookAheadToken.type === 'rs') {
                        if (strict && content === "") {
                            throw "previous line: map key must not be empty";
                        }
                        if (strict && content.indexOf(" ") !== -1) {
                            throw "previous line: map key must not contain spaces";
                        }
                        if (content[0] === '.') {
                            key = content.substr(1);
                            tokens.push({
                                type: 'sk',
                                body: unescapeFromJson(key, true)
                            });
                            contexts.push('s');
                        } else {
                            tokens.push({
                                type: 'mk',
                                body: unescapeFromJson(content, true)
                            });
                            contexts.push('m');
                        }
                        i += 1;
                    } else {
                        if (content[0] === '.') {
                            key = content.substr(1);
                            tokens.push({
                                type: 'ske',
                                body: unescapeFromJson(key, true)
                            });
                        } else if (content[0] === '-') {
                            key = content.substr(1);
                            tokens.push({
                                type: 'mke',
                                body: unescapeFromJson(key, true)
                            });
                        } else {
                            //handle escaping of - and .
                            matchResult = content.match(/^(\\*)[\.\-](.*)/);
                            backslashesInFront = "";
                            if (matchResult !== null) {
                                backslashes = matchResult[1];
                                //remove one backslash, backslashes will be added separately, so remove them from content
                                backslashesInFront = backslashes.substr(1);
                                content = content.substr(backslashes.length);
                            }

                            //ignore escaped spaces
                            firstSpacePosition = indexOfFirstUnescapedSpace(content);
                            if (strict && firstSpacePosition === -1) {
                                throw "expected key and value separated by unescaped space or indentation on next line";
                            }
                            //if in non strict mode, the whole content is the key if there is no space
                            if (firstSpacePosition === -1) {
                                firstSpacePosition = content.length;
                            }
                            key = content.substring(0, firstSpacePosition);
                            value = content.substring(firstSpacePosition + 1);
                            if (strict && key === "") {
                                throw "value key must not be empty";
                            }
                            if (strict && value === "") {
                                throw "value must not be empty";
                            }
                            tokens.push({
                                type: 'k',
                                body: backslashesInFront + convertAsonKeyToObjectValue(key)
                            });
                            tokens.push({
                                type: 'v',
                                body: convertAsonValueToObjectValue(value)
                            });
                        }
                    }
                } else if (context === 's') {
                    lookAheadToken = shiftTokens[i + 1];
                    if (lookAheadToken !== undefined && lookAheadToken.type === 'rs') {
                        if (content === '.') {
                            tokens.push({
                                type: 's'
                            });
                            contexts.push('s');
                        } else {
                            if (strict && content !== '-') {
                                throw "in a sequence, indentation is introduced by a - or . character on previous line";
                            }
                            tokens.push({
                                type: 'am'
                            });
                            contexts.push('m');
                        }
                        i += 1;
                    } else {
                        if (content[0] === '.') {
                            if (strict && content.length > 1) {
                                throw "in a sequence, an empty sequence is depicted with only one . character";
                            }
                            tokens.push({
                                type: 'se'
                            });
                        } else if (content[0] === '-') {
                            if (strict && content.length > 1) {
                                throw "in a sequence, an empty map is depicted with only one - character";
                            }
                            tokens.push({
                                type: 'me'
                            });
                        } else {
                            tokens.push({
                                type: 'v',
                                body: convertAsonValueToObjectValue(content)
                            });
                        }
                    }
                }
            } else if (locToken.type === 'ls') {
                k = 0;
                while (k < locToken.body) {
                    contexts.pop();
                    k += 1;
                }
                tokens.push(locToken);
            } else {
                if (strict) {
                    throw "unkown token: " + JSON.stringify(locToken);
                }
                tokens.push(locToken);
            }

            i += 1;
        }
        return tokens;
    };
    //--------------------------------TOKENIZING END

    //--------------------------------TOKENS TO JSON
    /**
    Interprets ason tokens and generates JSON.
    **/
    var generateJSON = function (asonTokens, prettyPrint) {
        var countMapOrValueElements = 0; //json compatibility. remove sequence if only one map or one value in root sequence and no other sequence element
        var countSequenceElements = 0;

        var contexts = ['s'];
        var output;

        output = "[";

        var lastToken;
        var comma = function () {
            if (lastToken !== undefined) {
                switch (lastToken.type) {
                case 'v':
                case 'ske':
                case 'mke':
                case 'se':
                case 'me':
                case 'ls':
                    output += ',';
                    if (prettyPrint) {
                        output += '\n';
                    }
                    break;
                }
            }
        };
        var count;
        var j;
        var context;
        asonTokens.forEach(function (token) {
            switch (token.type) {
            case 'ls':
                count = token.body;
                j = 0;
                while (j < count) {
                    context = contexts[contexts.length - 1];
                    if (context === 'm') {
                        output += '}';
                    } else if (context === 's') {
                        output += ']';
                    }
                    contexts.pop();
                    j += 1;
                }

                break;
            case 'v':
                if (contexts.length === 1) {
                    countMapOrValueElements += 1;
                }
                comma();
                if (prettyPrint && lastToken !== undefined && lastToken.type !== 'k') {
                    output += levelToSpace(contexts.length - 1);
                }
                output += convertObjectValueToJsonValueFormat(token.body);
                break;
            case 'am':
                if (contexts.length === 1) {
                    countMapOrValueElements += 1;
                }
                comma();
                if (prettyPrint) {
                    output += levelToSpace(contexts.length - 1);
                }
                output += '{';
                if (prettyPrint) {
                    output += '\n';
                }
                contexts.push('m');
                break;
            case 's':
                if (contexts.length === 1) {
                    countSequenceElements += 1;
                }
                comma();
                if (prettyPrint) {
                    output += levelToSpace(contexts.length - 1);
                }
                output += '[';
                if (prettyPrint) {
                    output += '\n';
                }
                contexts.push('s');
                break;
            case 'k':
                comma();
                if (prettyPrint) {
                    output += levelToSpace(contexts.length - 1);
                }
                output += '"' + escapeToJson(token.body) + '":';
                break;
            case 'mk':
                comma();
                if (prettyPrint) {
                    output += levelToSpace(contexts.length - 1);
                }
                output += '"' + escapeToJson(token.body) + '":{';
                contexts.push('m');
                if (prettyPrint) {
                    output += '\n';
                }
                break;
            case 'mke':
                comma();
                if (prettyPrint) {
                    output += levelToSpace(contexts.length - 1);
                }
                output += '"' + escapeToJson(token.body) + '":{}';
                break;
            case 'sk':
                comma();
                if (prettyPrint) {
                    output += levelToSpace(contexts.length - 1);
                }
                output += '"' + escapeToJson(token.body) + '":[';
                contexts.push('s');
                if (prettyPrint) {
                    output += '\n';
                }
                break;
            case 'ske':
                comma();
                if (prettyPrint) {
                    output += levelToSpace(contexts.length - 1);
                }
                output += '"' + escapeToJson(token.body) + '":[]';
                break;
            case 'se':
                comma();
                if (prettyPrint) {
                    output += levelToSpace(contexts.length - 1);
                }
                output += '[]';
                break;
            case 'me':
                comma();
                if (prettyPrint) {
                    output += levelToSpace(contexts.length - 1);
                }
                output += '{}';
                break;
            }
            lastToken = token;
        });

        while (contexts.length > 0) {
            context = contexts[contexts.length - 1];
            if (context === 'm') {
                output += '}';
            } else if (context === 's') {
                output += ']';
            }
            contexts.pop();
        }
        if (countMapOrValueElements === 1 && countSequenceElements === 0) {
            output = output.slice(1, output.length - 1);
        }
        return output;
    };
    //--------------------------------TOKENS TO JSON END


    var hasKeys = function (o) {
        return Object.keys(o).length > 0;
    };
    //-----------------------------JS Object to ASON
    //http://stackoverflow.com/questions/8511281/check-if-a-variable-is-an-object-in-javascript
    var isObject = function (o) {
        return o !== null && typeof o === 'object';
    };

    var arrayToAson;
    var objToAson;

    objToAson = function (o, level) {
        var output = "";
        Object.keys(o).forEach(function (key) {
            output += levelToSpace(level);

            var value = o[key];
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    output += "." + escapeToJson(key) + "\n";
                } else {
                    output += "." + escapeToJson(key) + "\n" + arrayToAson(value, level + 1);
                }
            } else if (isObject(value)) { //warn: array is also an object
                if (!hasKeys(value)) {
                    output += "-" + escapeToJson(key) + "\n";
                } else {
                    output += escapeToJson(key) + "\n" + objToAson(value, level + 1);
                }
            } else {
                //Use escaping. Turn spaces in keys into \<space>
                output += convertStringToAsonKeyString(key) + " " + convertObjectValueToAsonValueString(value) + "\n";
            }
        });

        return output;
    };

    arrayToAson = function (arr, level) {
        var output = "";
        arr.forEach(function (el) {
            output += levelToSpace(level);
            if (Array.isArray(el)) {
                output += ".\n";
                output += arrayToAson(el, level + 1);
            } else if (isObject(el)) {
                output += "-\n";
                output += objToAson(el, level + 1);
            } else {
                output += convertObjectValueToAsonValueString(el) + "\n";
            }
        });

        //if (output[output.length-1] === "\n") output = output.slice(0,output.length-1);
        return output;
    };
    //-----------------------------JS Object to ASON END

    //-----------------------------CONVERSIONS
    /**
    Converts a JS object to Ason
    */
    var stringify = function (o) {
        var output = "";
        var level = 0;
        if (Array.isArray(o)) {
            output += arrayToAson(o, level);
        } else if (isObject(o)) {
            output += "-\n";
            output += objToAson(o, level + 1);
        } else {
            output += convertObjectValueToAsonValueString(o);
        }
        if (output[output.length - 1] === "\n") {
            output = output.slice(0, output.length - 1);
        }
        return output;
    };

    var asonToJson = function (ason, prettyPrint, strict) {
        var shiftTokens = shiftTokenizer(ason, strict);
        var asonTokens = asonTokenizer(shiftTokens, strict);
        return generateJSON(asonTokens, prettyPrint);
    };

    var jsonToAson = function (json) {
        //TODO direct conversion json ason?

        var o = JSON.parse(json);
        return stringify(o);
    };

    /**
    Converts ASON to a JS Object
    */
    var parse = function (str) {
        var tokens = asonTokenizer(shiftTokenizer(str, false), false);
        var nRootChildren = 0;
        var stack = [[]];
        var i;
        var o;
        var a;
        var currentIndex = 0;
        var key;
        var value;
        while (currentIndex < tokens.length) {
            if (tokens[currentIndex].type === 'k') {
                key = tokens[currentIndex].body;
                currentIndex += 1;
                value = tokens[currentIndex].body;
                stack[stack.length - 1][key] = value;
            } else if (tokens[currentIndex].type === 'v') {
                if (stack.length === 1) {
                    nRootChildren += 1;
                }
                stack[stack.length - 1].push(tokens[currentIndex].body);
            } else if (tokens[currentIndex].type === 'mk') {
                o = {};
                stack[stack.length - 1][tokens[currentIndex].body] = o;
                stack.push(o);
            } else if (tokens[currentIndex].type === 'sk') {
                a = [];
                stack[stack.length - 1][tokens[currentIndex].body] = a;
                stack.push(a);
            } else if (tokens[currentIndex].type === 'ls') {
                i = 0;
                while (i < tokens[currentIndex].body) {
                    stack.pop();
                    i += 1;
                }
            } else if (tokens[currentIndex].type === 'am') {
                if (stack.length === 1) {
                    nRootChildren += 1;
                }
                o = {};
                stack[stack.length - 1].push(o);
                stack.push(o);
            } else if (tokens[currentIndex].type === 's') {
                if (stack.length === 1) {
                    nRootChildren += 1;
                }
                a = [];
                stack[stack.length - 1].push(a);
                stack.push(a);
            } else if (tokens[currentIndex].type === 'mke') {
                stack[stack.length - 1][tokens[currentIndex].body] = {};
            } else if (tokens[currentIndex].type === 'ske') {
                stack[stack.length - 1][tokens[currentIndex].body] = [];
            } else if (tokens[currentIndex].type === 'me') {
                if (stack.length === 1) {
                    nRootChildren += 1;
                }
                stack[stack.length - 1].push({});
            } else if (tokens[currentIndex].type === 'se') {
                if (stack.length === 1) {
                    nRootChildren += 1;
                }
                stack[stack.length - 1].push([]);
            }
            currentIndex += 1;
        }
        if (nRootChildren === 1) {
            return stack[0][0];
        }
        return stack[0];
    };
    //-----------------------------CONVERSIONS END

    exports.asonToJson = asonToJson;
    exports.getLines = getLines;
    exports.getLevel = getLevel;
    exports.shiftTokenizer = shiftTokenizer;
    exports.asonTokenizer = asonTokenizer;
    exports.generateJSON = generateJSON;
    exports.jsonToAson = jsonToAson;
    exports.stringify = stringify;
    exports.parse = parse;

    exports.unescapeFromJson = unescapeFromJson;
    exports.convertAsonValueToObjectValue = convertAsonValueToObjectValue;
    exports.convertObjectValueToJsonValueFormat = convertObjectValueToJsonValueFormat;

    //-----------------------------CONSOLE INTERFACE
    var printHelp = function () {
        var str = "Usage\nnode ASON.js [-(a|j[p][s])] [sourceFile [destinationFile]]\n\n    Converts json to ason and vice versa.\n\n    Options:\n    a convert json to ason\n    j convert ason to json\n    p apply pretty print to resulting json\n    s strict mode. Conversion from ason to json is aborted when a rule is violated.\n\n    When sourceFile is not specified, convert stdin. The result is outputed on stdout.\n    When no option is given, option a is implied.\n\n    e.g.:\n    echo true | node Ason.js -j\n    echo {\"a\":5} | node Ason.js -a";
        process.stdout.write(str);
    };

    if (typeof require === 'function' && require.main === module) {
        var paramIndex = 2;
        var options = process.argv[paramIndex];
        if (options !== undefined && options.substring(0, 1) === "-") {
            paramIndex += 1;
        } else {
            options = "-a";
        }

        options = options.substring(1);

        var fnToCall;
        var destType;

        //TODO print line number when conversion failed
        if (options === "a") {
            fnToCall = jsonToAson;
            destType = "ason";

        } else if (options === "j") {
            fnToCall = asonToJson;
            destType = "json";
        } else if (options === "js") {
            fnToCall = function (input) {
                return asonToJson(input, false, true);
            };
            destType = "json";
        } else if (options === "jp") {
            fnToCall = function (input) {
                return asonToJson(input, true, false);
            };
            destType = "json";
        } else if (options === "jps") {
            fnToCall = function (input) {
                return asonToJson(input, true, true);
            };
            destType = "json";
        } else {
            process.stdout.write("options not valid\n");
            printHelp();
            process.exit(13);
        } //TODO validate option v. convert windows line breaks option w.

        var sourceFile = process.argv[paramIndex];
        if (sourceFile === "" || sourceFile === undefined) {
            process.stdin.setEncoding('utf8');

            var input = "";

            process.stdin.on('readable', function () {

                var chunk = process.stdin.read();

                if (chunk !== null) {

                    //TODO data could be read as a stream and continually converted to ason/json
                    input += chunk;
                }
            });

            process.stdin.on('end', function () {
                try {
                    var strForStdOut = fnToCall(input);
                    process.stdout.write(strForStdOut);
                } catch (e) {
                    process.stdout.write("Conversion failed " + e);
                    process.exit(14);
                }
            });
        } else {
            var destinationFile = process.argv[4];
            var fs = require('fs');
            var conversionResult;
            if (destinationFile === "" || destinationFile === undefined) {

                fs.readFile(sourceFile, function (err, data) {
                    try {
                        if (err) {
                            throw err;
                        }
                        conversionResult = fnToCall(data.toString());
                    } catch (e) {
                        process.stdout.write("Conversion failed " + e);
                        process.exit(14);
                    }

                    var newFile = sourceFile + "." + destType;
                    fs.writeFile(newFile, conversionResult, function (err) {
                        if (err) {
                            throw err;
                        }
                        process.stdout.write("Created file at " + newFile);
                        process.exit(0);
                    });
                });
            } else {
                fs.readFile(sourceFile, function (err, data) {
                    try {
                        if (err) {
                            throw err;
                        }
                        conversionResult = fnToCall(data.toString());
                    } catch (e) {
                        process.stdout.write("Conversion failed " + e);
                        process.exit(14);
                    }
                    fs.writeFile(destinationFile, conversionResult, function (err) {
                        if (err) {
                            throw err;
                        }
                        process.stdout.write("Created file at " + destinationFile);
                        process.exit(0);
                    });
                });
            }
        }

    }


//--------------------------------CONSOLE INTERFACE END
}());
