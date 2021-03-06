/**
 * @fileoverview Defines space in parens with quotes inside
 * @author Ivan
 */
"use strict";

const astUtils = require("../ast-utils");

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
    meta: {
        docs: {
            description: "enforce consistent spacing inside parentheses",
            category: "Stylistic Issues",
            recommended: false
        },

        fixable: "whitespace",

        schema: [
            {
                enum: ["always", "never"]
            },
            {
                type: "object",
                properties: {
                    exceptions: {
                        type: "array",
                        items: {
                            enum: ["{}", "[]", "()", "empty", "(STRING)"]
                        },
                        uniqueItems: true
                    }
                },
                additionalProperties: false
            }
        ]
    },

    create(context) {

        const MISSING_SPACE_MESSAGE   = "There must be a space inside this paren.",
            REJECTED_SPACE_MESSAGE    = "There should be no spaces inside this paren.",
            UNNECESSARY_SPACE_MESSAGE = "There must be no space inside this paren with STRING expression.",
            ALWAYS                    = context.options[0] === "always",

            exceptionsArrayOptions    = (context.options.length === 2) ? context.options[1].exceptions : [],
            options                   = {};

        let exceptions;

        if (exceptionsArrayOptions.length) {
            options.braceException       = exceptionsArrayOptions.indexOf("{}") !== -1;
            options.bracketException     = exceptionsArrayOptions.indexOf("[]") !== -1;
            options.parenException       = exceptionsArrayOptions.indexOf("()") !== -1;
            options.parenStringException = exceptionsArrayOptions.indexOf("(STRING)") !== -1;
            options.empty                = exceptionsArrayOptions.indexOf("empty") !== -1;
        }

        /**
         * Produces an object with the opener and closer exception values
         * @param {Object} opts The exception options
         * @returns {Object} `openers` and `closers` exception values
         * @private
         */
        function getExceptions() {
            const openers = [],
                closers = [];

            if (options.braceException) {
                openers.push("{");
                closers.push("}");
            }

            if (options.bracketException) {
                openers.push("[");
                closers.push("]");
            }

            if (options.parenException) {
                openers.push("(");
                closers.push(")");
            }

            if (options.empty) {
                openers.push(")");
                closers.push("(");
            }

            return {
                openers,
                closers
            };
        }

        //--------------------------------------------------------------------------
        // Helpers
        //--------------------------------------------------------------------------
        const sourceCode = context.getSourceCode();

        /**
         * Determines if a token is one of the exceptions for the opener paren
         * @param {Object} token The token to check
         * @returns {boolean} True if the token is one of the exceptions for the opener paren
         */
        function isOpenerException(token) {
            return token.type === "Punctuator" && exceptions.openers.indexOf(token.value) >= 0;
        }

        /**
         * Determines if a token is one of the exceptions for the closer paren
         * @param {Object} token The token to check
         * @returns {boolean} True if the token is one of the exceptions for the closer paren
         */
        function isCloserException(token) {
            return token.type === "Punctuator" && exceptions.closers.indexOf(token.value) >= 0;
        }

        /**
         * Determines if an opener paren should have a missing space after it
         * @param {Object} left The paren token
         * @param {Object} right The token after it
         * @returns {boolean} True if the paren should have a space
         */
        function shouldOpenerHaveSpace(left, right) {
            if (sourceCode.isSpaceBetweenTokens(left, right)) {
                return false;
            }

            if (ALWAYS) {
                if (right.type === "Punctuator" && right.value === ")") {
                    return false;
                }
                return !isOpenerException(right);
            } else {
                return isOpenerException(right);
            }
        }

        /**
         * Determines if an closer paren should have a missing space after it
         * @param {Object} left The token before the paren
         * @param {Object} right The paren token
         * @returns {boolean} True if the paren should have a space
         */
        function shouldCloserHaveSpace(left, right) {
            if (left.type === "Punctuator" && left.value === "(") {
                return false;
            }

            if (sourceCode.isSpaceBetweenTokens(left, right)) {
                return false;
            }

            if (ALWAYS) {
                return !isCloserException(left);
            } else {
                return isCloserException(left);
            }
        }

        /**
         * Determines if an opener paren should not have an existing space after it
         * @param {Object} left The paren token
         * @param {Object} right The token after it
         * @returns {boolean} True if the paren should reject the space
         */
        function shouldOpenerRejectSpace(left, right) {
            if (right.type === "Line") {
                return false;
            }

            if (!astUtils.isTokenOnSameLine(left, right)) {
                return false;
            }

            if (!sourceCode.isSpaceBetweenTokens(left, right)) {
                return false;
            }

            if (ALWAYS) {
                return isOpenerException(right);
            } else {
                return !isOpenerException(right);
            }
        }

        /**
         * Determines if an closer paren should not have an existing space after it
         * @param {Object} left The token before the paren
         * @param {Object} right The paren token
         * @returns {boolean} True if the paren should reject the space
         */
        function shouldCloserRejectSpace(left, right) {
            if (left.type === "Punctuator" && left.value === "(") {
                return false;
            }

            if (!astUtils.isTokenOnSameLine(left, right)) {
                return false;
            }

            if (!sourceCode.isSpaceBetweenTokens(left, right)) {
                return false;
            }

            if (ALWAYS) {
                return isCloserException(left);
            } else {
                return !isCloserException(left);
            }
        }

        function checkStringInParen(node, prevToken, token, nextToken) {
            if (sourceCode.isSpaceBetweenTokens(prevToken, token)) {
                context.report({
                    node,
                    loc: token.loc.start,
                    message: UNNECESSARY_SPACE_MESSAGE,
                    fix(fixer) {
                        return fixer.removeRange([prevToken.end, token.start]);
                    }
                });

            }

            if (sourceCode.isSpaceBetweenTokens(token, nextToken)) {
                context.report({
                    node,
                    loc: nextToken.loc.start,
                    message: UNNECESSARY_SPACE_MESSAGE,
                    fix(fixer) {
                        return fixer.removeRange([token.end, nextToken.start]);
                    }
                });

            }
        }

        function stringInParenAlreadyChecked(tokens, i) {
            if ((tokens[ i ].type === "Punctuator" && tokens[ i ].value === "(" && tokens[i + 1].type === 'String' && tokens[i + 2].value === ')') ||
                (tokens[ i ].type === 'String' && tokens[ i - 1 ].value  === "(" && tokens[i + 1].value === ')') ||
                (tokens[ i ].type === "Punctuator" && tokens[ i ].value === ")" && tokens[i - 1].type === "String" && tokens[i - 2].type  === "Punctuator" && tokens[i - 2].value === "(" ) ) {
                return true;
            }

            return false;
        }

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        return {
            Program: function checkParenSpaces(node) {
                exceptions = getExceptions();
                const tokens = sourceCode.tokensAndComments;

                tokens.forEach(function(token, i) {
                    const prevToken = tokens[i - 1];
                    const nextToken = tokens[i + 1];

                    if ( options.parenStringException &&
                        token.type      === "String" &&
                        prevToken.type  === "Punctuator" &&
                        nextToken.type  === "Punctuator" &&
                        prevToken.value === "(" &&
                        nextToken.value === ")") {

                        checkStringInParen(node, prevToken, token, nextToken);
                        return;
                    }

                    if (options.parenStringException && stringInParenAlreadyChecked(tokens, i)) {
                        return;
                    }

                    if (token.type !== "Punctuator") {
                        return;
                    }

                    if (token.value !== "(" && token.value !== ")") {
                        return;
                    }

                    if (token.value === "(" && shouldOpenerHaveSpace(token, nextToken)) {
                        context.report({
                            node,
                            loc: token.loc.start,
                            message: MISSING_SPACE_MESSAGE,
                            fix(fixer) {
                                return fixer.insertTextAfter(token, " ");
                            }
                        });
                    } else if (token.value === "(" && shouldOpenerRejectSpace(token, nextToken)) {
                        context.report({
                            node,
                            loc: token.loc.start,
                            message: REJECTED_SPACE_MESSAGE,
                            fix(fixer) {
                                return fixer.removeRange([token.range[1], nextToken.range[0]]);
                            }
                        });
                    } else if (token.value === ")" && shouldCloserHaveSpace(prevToken, token)) {

                        // context.report(node, token.loc.start, MISSING_SPACE_MESSAGE);
                        context.report({
                            node,
                            loc: token.loc.start,
                            message: MISSING_SPACE_MESSAGE,
                            fix(fixer) {
                                return fixer.insertTextBefore(token, " ");
                            }
                        });
                    } else if (token.value === ")" && shouldCloserRejectSpace(prevToken, token)) {
                        context.report({
                            node,
                            loc: token.loc.start,
                            message: REJECTED_SPACE_MESSAGE,
                            fix(fixer) {
                                return fixer.removeRange([prevToken.range[1], token.range[0]]);
                            }
                        });
                    }
                });
            }
        };

    }
};
