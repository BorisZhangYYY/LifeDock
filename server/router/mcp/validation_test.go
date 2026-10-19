package mcp

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateToolArgumentsRejectsUnknownArguments(t *testing.T) {
	schema := jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"pageSize": map[string]any{"type": "integer"},
		},
		"additionalProperties": false,
	}

	err := validateToolArguments(schema, map[string]any{"unexpected": true})
	require.ErrorContains(t, err, `unknown argument "unexpected"`)
}

func TestCompiledToolValidatorSupportsConcurrentCalls(t *testing.T) {
	validator, err := compileToolArgumentValidator(jsonSchema{
		"type": "object", "additionalProperties": false,
		"properties": map[string]any{"date": jsonSchema{"type": "string", "pattern": `^\d{4}-\d{2}-\d{2}$`}},
		"required":   []string{"date"},
	})
	require.NoError(t, err)
	var callers sync.WaitGroup
	for range 20 {
		callers.Go(func() {
			for range 20 {
				if err := validator.validate(map[string]any{"date": "2026-10-19"}); err != nil {
					t.Errorf("valid concurrent call failed: %v", err)
				}
				if err := validator.validate(map[string]any{"date": "invalid"}); err == nil {
					t.Error("invalid concurrent call was accepted")
				}
			}
		})
	}
	callers.Wait()
}

func TestToolHandlerRejectsInvalidSchemaAtConstruction(t *testing.T) {
	_, err := newMCPToolHandler(nil, &registeredOperation{InputSchema: jsonSchema{
		"type": "object", "properties": map[string]any{"broken": jsonSchema{"$ref": "#/$defs/Missing"}},
	}})
	require.ErrorContains(t, err, "failed to resolve")
}

func BenchmarkToolArgumentValidation(b *testing.B) {
	spec, err := loadMCPServiceOpenAPISpec()
	require.NoError(b, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(b, err)
	tool, _ := buildToolFromOperation(registry["MemoService_CreateMemo"])
	schema := requireValueAs[jsonSchema](b, tool.InputSchema)
	arguments := map[string]any{"body": map[string]any{"content": "A daily note", "visibility": "PRIVATE"}}
	validator, err := compileToolArgumentValidator(schema)
	require.NoError(b, err)
	b.Run("compile_each_call", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			if err := validateToolArguments(schema, arguments); err != nil {
				b.Fatal(err)
			}
		}
	})
	b.Run("precompiled", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			if err := validator.validate(arguments); err != nil {
				b.Fatal(err)
			}
		}
	})
}

func TestValidateToolArgumentsRejectsMissingRequiredArguments(t *testing.T) {
	schema := jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"memo": map[string]any{"type": "string"},
		},
		"required":             []string{"memo"},
		"additionalProperties": false,
	}

	err := validateToolArguments(schema, map[string]any{})
	require.ErrorContains(t, err, `missing required argument "memo"`)
}

func TestValidateToolArgumentsRejectsWrongPrimitiveTypes(t *testing.T) {
	schema := jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"pageSize": map[string]any{"type": "integer"},
		},
		"additionalProperties": false,
	}

	err := validateToolArguments(schema, map[string]any{"pageSize": "ten"})
	require.ErrorContains(t, err, `argument "pageSize" must be integer`)
}

func TestValidateToolArgumentsUsesJSONSchemaValidation(t *testing.T) {
	schema := jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"state": map[string]any{
				"type": "string",
				"enum": []any{"NORMAL", "ARCHIVED"},
			},
		},
		"additionalProperties": false,
	}

	err := validateToolArguments(schema, map[string]any{"state": "DELETED"})
	require.ErrorContains(t, err, "MCP tool arguments do not match input schema")
}
