#!/usr/bin/env bun
/**
 * Kinda lazy to use commander or such.
 * So here's the simple code to register the user to the Booru client.
 */
import { addUser } from "utils/db";

const email = process.argv[2];
const password = process.argv[3];

if (!email && !password) {
    console.log("Usage: bun addUser.js <email> <password>");
} else if (!email.includes("@")) {
    console.error("Email is invalid!");
    console.log("Usage: bun addUser.js <email> <password>");
} else {
    addUser(email, Bun.password.hashSync(password));
    console.log(email + " registered");
}