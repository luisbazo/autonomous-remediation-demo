package com.ibm.demo;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;

@QuarkusTest
public class MemoryLeakResourceTest {

    @Test
    public void testHealthEndpoint() {
        given()
          .when().get("/api/health")
          .then()
             .statusCode(200)
             .body("status", is("UP"))
             .body("timestamp", notNullValue());
    }

    @Test
    public void testGetDataEndpoint() {
        given()
          .when().get("/api/data")
          .then()
             .statusCode(200)
             .body("message", is("Normal operation"))
             .body("requestId", notNullValue());
    }

    @Test
    public void testMemoryStatsEndpoint() {
        given()
          .when().get("/api/memory-stats")
          .then()
             .statusCode(200)
             .body("maxMemoryMB", notNullValue())
             .body("usedMemoryMB", notNullValue());
    }

    @Test
    public void testTriggerLeakEndpoint() {
        given()
          .queryParam("size", "1")
          .when().post("/api/trigger-leak")
          .then()
             .statusCode(200)
             .body("status", is("leak_triggered"))
             .body("allocatedMB", is(1));
    }

    @Test
    public void testClearLeaksEndpoint() {
        given()
          .when().delete("/api/clear-leaks")
          .then()
             .statusCode(200)
             .body("status", is("cleared"));
    }

    @Test
    public void testResetEndpoint() {
        given()
          .when().post("/api/reset")
          .then()
             .statusCode(200)
             .body("status", is("reset"));
    }
}

// Made with Bob
