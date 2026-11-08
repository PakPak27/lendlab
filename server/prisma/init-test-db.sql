-- Runs once when the Docker "db" container is first created.
-- Creates the separate database used by the API/integration tests.
CREATE DATABASE lendlab_test OWNER lendlab;
